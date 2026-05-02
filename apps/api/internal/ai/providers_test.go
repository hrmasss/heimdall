package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/heimdall/api/internal/config"
)

func TestGenerateCopilotUsesOpenAICompatibleChatCompletions(t *testing.T) {
	var seenPath string
	var seenBearer string
	var seenGitHubToken string
	var seenModel string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seenPath = r.URL.Path
		seenBearer = r.Header.Get("Authorization")
		seenGitHubToken = r.Header.Get("X-GitHub-Token")
		var body struct {
			Model string `json:"model"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		seenModel = body.Model
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"{\"ok\":true}"}}],"usage":{"prompt_tokens":1,"completion_tokens":2,"total_tokens":3}}`))
	}))
	defer server.Close()

	service := NewService(nil, config.AIConfig{
		RequestTimeout: time.Second,
		CopilotBaseURL: server.URL,
	}, nil, nil)

	text, usage, err := service.generateJSON(context.Background(), providerCopilot, "gpt-test", "token-123", "system", "user", nil)
	if err != nil {
		t.Fatalf("generate copilot: %v", err)
	}
	if seenPath != "/chat/completions" {
		t.Fatalf("expected chat completions path, got %q", seenPath)
	}
	if seenBearer != "Bearer token-123" {
		t.Fatalf("expected bearer token, got %q", seenBearer)
	}
	if seenGitHubToken != "token-123" {
		t.Fatalf("expected GitHub token header, got %q", seenGitHubToken)
	}
	if seenModel != "gpt-test" {
		t.Fatalf("expected model gpt-test, got %q", seenModel)
	}
	if text != `{"ok":true}` || usage.TotalTokens != 3 {
		t.Fatalf("unexpected response %q usage %#v", text, usage)
	}
}
