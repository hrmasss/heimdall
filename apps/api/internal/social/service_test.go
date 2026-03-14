package social

import (
	"testing"

	"github.com/heimdall/api/internal/database"
)

func TestSelectionScopeForMetaTargets(t *testing.T) {
	t.Run("facebook pages keep a facebook scoped default", func(t *testing.T) {
		target := database.SocialTarget{Provider: "meta", TargetType: "facebook_page"}
		if got := selectionScopeForTarget(target); got != "facebook" {
			t.Fatalf("selectionScopeForTarget() = %q, want %q", got, "facebook")
		}
	})

	t.Run("instagram business accounts keep an instagram scoped default", func(t *testing.T) {
		target := database.SocialTarget{Provider: "meta", TargetType: "instagram_professional"}
		if got := selectionScopeForTarget(target); got != "instagram" {
			t.Fatalf("selectionScopeForTarget() = %q, want %q", got, "instagram")
		}
	})
}

func TestTargetMatchesPlatform(t *testing.T) {
	tests := []struct {
		name     string
		target   database.SocialTarget
		platform string
		want     bool
	}{
		{
			name:     "facebook post matches meta page target",
			target:   database.SocialTarget{Provider: "meta", TargetType: "facebook_page"},
			platform: "facebook",
			want:     true,
		},
		{
			name:     "instagram post matches meta instagram target",
			target:   database.SocialTarget{Provider: "meta", TargetType: "instagram_professional"},
			platform: "instagram",
			want:     true,
		},
		{
			name:     "facebook post does not match meta instagram target",
			target:   database.SocialTarget{Provider: "meta", TargetType: "instagram_professional"},
			platform: "facebook",
			want:     false,
		},
		{
			name:     "native provider still matches itself",
			target:   database.SocialTarget{Provider: "x", TargetType: "account"},
			platform: "x",
			want:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := targetMatchesPlatform(tt.target, tt.platform); got != tt.want {
				t.Fatalf("targetMatchesPlatform() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestAbsoluteURLPreservesSignedQuery(t *testing.T) {
	got := absoluteURL("https://assets.example.test", "/api/v1/resource-blobs/file.jpg?expires=123&sig=abc")
	want := "https://assets.example.test/api/v1/resource-blobs/file.jpg?expires=123&sig=abc"
	if got != want {
		t.Fatalf("absoluteURL() = %q, want %q", got, want)
	}
}
