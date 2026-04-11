package config

import "testing"

func TestLoadParsesPluralProviderKeys(t *testing.T) {
	t.Setenv("OPENAI_API_KEYS", "openai-one, openai-two")
	t.Setenv("GEMINI_API_KEYS", "gemini-one, gemini-two")
	t.Setenv("TAVILY_API_KEYS", "tavily-one, tavily-two")

	cfg := Load()

	if got := cfg.AI.OpenAIAPIKeys; len(got) != 2 || got[0] != "openai-one" || got[1] != "openai-two" {
		t.Fatalf("unexpected OpenAI key list: %#v", got)
	}
	if got := cfg.AI.GeminiAPIKeys; len(got) != 2 || got[0] != "gemini-one" || got[1] != "gemini-two" {
		t.Fatalf("unexpected Gemini key list: %#v", got)
	}
	if got := cfg.Automation.TavilyAPIKeys; len(got) != 2 || got[0] != "tavily-one" || got[1] != "tavily-two" {
		t.Fatalf("unexpected Tavily key list: %#v", got)
	}
}

func TestLoadFallsBackToSingularProviderKeys(t *testing.T) {
	t.Setenv("GEMINI_API_KEYS", "")
	t.Setenv("TAVILY_API_KEYS", "")
	t.Setenv("GEMINI_API_KEY", "gemini-single")
	t.Setenv("TAVILY_API_KEY", "tavily-single")

	cfg := Load()

	if got := cfg.AI.GeminiAPIKeys; len(got) != 1 || got[0] != "gemini-single" {
		t.Fatalf("unexpected Gemini key fallback: %#v", got)
	}
	if got := cfg.Automation.TavilyAPIKeys; len(got) != 1 || got[0] != "tavily-single" {
		t.Fatalf("unexpected Tavily key fallback: %#v", got)
	}
}
