package ai

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/heimdall/api/internal/config"
)

func TestResolveCredentialChainReturnsNativeWaterfallKeys(t *testing.T) {
	service := &Service{cfg: config.AIConfig{GeminiAPIKeys: []string{"gemini-one", "gemini-two"}}}

	credentials, err := service.resolveCredentialChain(context.Background(), uuid.New(), providerGemini, modeNative, false)
	if err != nil {
		t.Fatalf("resolve credential chain: %v", err)
	}

	if len(credentials) != 2 {
		t.Fatalf("expected two native credentials, got %#v", credentials)
	}
	if credentials[0].apiKey != "gemini-one" || credentials[1].apiKey != "gemini-two" {
		t.Fatalf("unexpected native credential order: %#v", credentials)
	}
}

func TestNativeCredentialChainFallsBackToSingularKey(t *testing.T) {
	service := &Service{cfg: config.AIConfig{GeminiAPIKey: "gemini-single"}}

	credentials, err := service.resolveCredentialChain(context.Background(), uuid.New(), providerGemini, modeNative, false)
	if err != nil {
		t.Fatalf("resolve credential chain: %v", err)
	}

	if len(credentials) != 1 || credentials[0].apiKey != "gemini-single" {
		t.Fatalf("unexpected singular native credential fallback: %#v", credentials)
	}
}

func TestDefaultModeTreatsPluralKeysAsNative(t *testing.T) {
	mode := defaultMode(config.AIConfig{GeminiAPIKeys: []string{"gemini-one"}})

	if mode != modeNative {
		t.Fatalf("expected native mode, got %q", mode)
	}
}
