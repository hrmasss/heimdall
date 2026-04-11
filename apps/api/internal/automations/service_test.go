package automations

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/heimdall/api/internal/config"
)

func TestNormalizePostAgentOptionsDefaults(t *testing.T) {
	service := &Service{cfg: config.AutomationConfig{PostAgentDefaultResearchDepth: "quick"}}

	options := service.normalizePostAgentOptions(map[string]any{}, map[string]any{})

	if options.UseWebResearch {
		t.Fatalf("expected generic post generation to keep web research off by default")
	}
	if !options.TrendAware || !options.IncludeHookOptions || !options.IncludeTags || !options.IncludeImageBrief {
		t.Fatalf("expected simple user-friendly options to default on: %#v", options)
	}
	if options.DeepResearch || options.IncludeVideoBrief {
		t.Fatalf("expected costly/future options to default off: %#v", options)
	}
	if len(options.Targets) != 3 {
		t.Fatalf("expected default destination targets, got %#v", options.Targets)
	}
}

func TestTavilyResearchRequestShape(t *testing.T) {
	var requestBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/search" {
			t.Fatalf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Fatalf("unexpected authorization header %q", got)
		}
		if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"answer": "Research summary",
			"results": [{
				"title": "Trend headline",
				"url": "https://example.com/trend",
				"content": "Useful source snippet",
				"score": 0.9,
				"published_date": "2026-04-10"
			}],
			"images": [{"url": "https://example.com/image.png", "description": "Chart image"}]
		}`))
	}))
	defer server.Close()

	provider := tavilyResearchProvider{
		client: server.Client(),
		cfg: config.AutomationConfig{
			TavilyAPIKey:                  "test-key",
			TavilyBaseURL:                 server.URL,
			PostAgentDefaultResearchDepth: "quick",
		},
	}
	result, err := provider.Research(context.Background(), webResearchRequest{
		Query:         "AI workflow trend",
		DeepResearch:  true,
		TrendAware:    true,
		TimeRange:     "week",
		IncludeImages: true,
		DefaultDepth:  "quick",
	})
	if err != nil {
		t.Fatalf("research failed: %v", err)
	}

	if requestBody["search_depth"] != "advanced" {
		t.Fatalf("expected deep research to use advanced search, got %#v", requestBody["search_depth"])
	}
	if requestBody["topic"] != "news" || requestBody["time_range"] != "week" {
		t.Fatalf("expected trend-aware news search, got %#v", requestBody)
	}
	if requestBody["include_images"] != true {
		t.Fatalf("expected image inclusion, got %#v", requestBody["include_images"])
	}
	if result.Summary != "Research summary" || len(result.SourceURLs) != 1 || len(result.TrendSignals) != 1 {
		t.Fatalf("unexpected research result: %#v", result)
	}
}

func TestTavilyResearchRequiresKey(t *testing.T) {
	provider := tavilyResearchProvider{
		client: http.DefaultClient,
		cfg:    config.AutomationConfig{TavilyBaseURL: "https://api.tavily.com"},
	}

	if _, err := provider.Research(context.Background(), webResearchRequest{Query: "topic"}); err == nil {
		t.Fatal("expected missing Tavily key to return a setup error")
	}
}

func TestTavilyResearchRetriesPluralKeysOnRateLimit(t *testing.T) {
	seenKeys := []string{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seenKeys = append(seenKeys, r.Header.Get("Authorization"))
		if len(seenKeys) == 1 {
			http.Error(w, "rate limited", http.StatusTooManyRequests)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"answer": "Research summary",
			"results": [{
				"title": "Trend headline",
				"url": "https://example.com/trend",
				"content": "Useful source snippet"
			}]
		}`))
	}))
	defer server.Close()

	provider := tavilyResearchProvider{
		client: server.Client(),
		cfg: config.AutomationConfig{
			TavilyAPIKeys: []string{"first-key", "second-key"},
			TavilyBaseURL: server.URL,
		},
	}
	result, err := provider.Research(context.Background(), webResearchRequest{Query: "AI workflow trend"})
	if err != nil {
		t.Fatalf("research failed: %v", err)
	}

	if result.Summary != "Research summary" {
		t.Fatalf("unexpected research result: %#v", result)
	}
	if len(seenKeys) != 2 || seenKeys[0] != "Bearer first-key" || seenKeys[1] != "Bearer second-key" {
		t.Fatalf("expected Tavily key waterfall, got %#v", seenKeys)
	}
}

func TestDeriveImagePromptUsesPostAgentBrief(t *testing.T) {
	prompt := deriveImagePrompt([]RunArtifact{{
		Type: artifactPostDraft,
		Data: map[string]any{
			"title": "Fallback title",
			"contentPayload": map[string]any{
				"body": "Fallback body",
			},
			"strategy": map[string]any{
				"imageBrief": map[string]any{
					"generationPrompt": "Use a sharp editorial thumbnail concept.",
				},
			},
		},
	}})

	if prompt != "Use a sharp editorial thumbnail concept." {
		t.Fatalf("expected image brief prompt handoff, got %q", prompt)
	}
}
