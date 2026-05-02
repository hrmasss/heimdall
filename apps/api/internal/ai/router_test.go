package ai

import (
	"testing"
	"time"
)

func TestOrderPoolCandidatesFirstHealthySkipsDisabledAndCooling(t *testing.T) {
	now := time.Date(2026, 5, 2, 12, 0, 0, 0, time.UTC)
	coolingUntil := now.Add(time.Hour)
	candidates := []poolCandidate{
		{id: "disabled", position: 0, status: credentialStatusDisabled, healthStatus: healthStatusHealthy},
		{id: "cooling", position: 1, status: credentialStatusActive, healthStatus: healthStatusCooling, cooldownUntil: &coolingUntil},
		{id: "healthy", position: 2, status: credentialStatusActive, healthStatus: healthStatusHealthy},
	}

	ordered, cursor := orderPoolCandidates(candidates, strategyFirstHealthy, 0, now)

	if cursor != 0 {
		t.Fatalf("first healthy should not advance cursor, got %d", cursor)
	}
	if len(ordered) != 1 || ordered[0].id != "healthy" {
		t.Fatalf("unexpected order: %#v", ordered)
	}
}

func TestOrderPoolCandidatesRoundRobinRotatesAndPersistsCursor(t *testing.T) {
	now := time.Date(2026, 5, 2, 12, 0, 0, 0, time.UTC)
	candidates := []poolCandidate{
		{id: "first", position: 0, status: credentialStatusActive, healthStatus: healthStatusHealthy},
		{id: "second", position: 1, status: credentialStatusActive, healthStatus: healthStatusHealthy},
		{id: "third", position: 2, status: credentialStatusActive, healthStatus: healthStatusHealthy},
	}

	ordered, cursor := orderPoolCandidates(candidates, strategyRoundRobin, 1, now)

	if cursor != 2 {
		t.Fatalf("expected cursor to advance to 2, got %d", cursor)
	}
	if got := []string{ordered[0].id, ordered[1].id, ordered[2].id}; got[0] != "second" || got[1] != "third" || got[2] != "first" {
		t.Fatalf("unexpected round robin order: %#v", got)
	}
}

func TestOrderPoolCandidatesAllCoolingReturnsEmpty(t *testing.T) {
	now := time.Date(2026, 5, 2, 12, 0, 0, 0, time.UTC)
	coolingUntil := now.Add(time.Hour)
	candidates := []poolCandidate{
		{id: "one", position: 0, status: credentialStatusActive, healthStatus: healthStatusCooling, cooldownUntil: &coolingUntil},
	}

	ordered, cursor := orderPoolCandidates(candidates, strategyFirstHealthy, 7, now)

	if len(ordered) != 0 {
		t.Fatalf("expected no healthy credentials, got %#v", ordered)
	}
	if cursor != 7 {
		t.Fatalf("expected cursor to remain unchanged, got %d", cursor)
	}
}

func TestCooldownDurationForProviderErrors(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want time.Duration
	}{
		{name: "rate limit", err: buildProviderError(429, []byte(`rate limit`)), want: time.Hour},
		{name: "credit", err: buildProviderError(402, []byte(`billing credit exhausted`)), want: 24 * time.Hour},
		{name: "auth", err: buildProviderError(401, []byte(`unauthorized`)), want: 24 * time.Hour},
		{name: "server", err: buildProviderError(503, []byte(`unavailable`)), want: 5 * time.Minute},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := cooldownDurationForError(tt.err); got != tt.want {
				t.Fatalf("expected %s, got %s", tt.want, got)
			}
		})
	}
}
