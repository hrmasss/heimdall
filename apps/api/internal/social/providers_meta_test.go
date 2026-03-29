package social

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/heimdall/api/internal/config"
	"github.com/heimdall/api/internal/database"
)

func TestMetaPublishInstagramRetriesMediaNotReady(t *testing.T) {
	previousDelays := metaInstagramPublishRetryDelays
	metaInstagramPublishRetryDelays = []time.Duration{0}
	defer func() {
		metaInstagramPublishRetryDelays = previousDelays
	}()

	publishAttempts := 0
	restore := swapSocialHTTPClient(t, httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/acct/media"):
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"id": "creation-123"})
		case strings.HasSuffix(r.URL.Path, "/acct/media_publish"):
			publishAttempts++
			w.Header().Set("Content-Type", "application/json")
			if publishAttempts == 1 {
				w.WriteHeader(http.StatusBadRequest)
				_ = json.NewEncoder(w).Encode(map[string]any{
					"error": map[string]any{
						"message":          "Media ID is not available",
						"type":             "OAuthException",
						"code":             9007,
						"error_subcode":    2207027,
						"error_user_title": "Cannot Publish",
						"error_user_msg":   "The media is not ready for publishing, please wait for a moment",
					},
				})
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"id": "published-456"})
		case strings.HasSuffix(r.URL.Path, "/published-456"):
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"permalink": "https://www.instagram.com/p/test/"})
		default:
			t.Fatalf("unexpected request path: %s", r.URL.Path)
		}
	})))
	defer restore()

	adapter := newMetaAdapter(config.SocialConfig{MetaAPIVersion: "v99.0"}).(*metaAdapter)
	result, err := adapter.PublishPost(
		context.Background(),
		providerSession{AccessToken: "token"},
		database.SocialTarget{TargetType: "instagram_professional", ExternalAccountID: "acct"},
		publishContent{Platform: "instagram", Surface: "feed_photo", Caption: "hello"},
		[]assetBlob{{
			PublicURL:    "https://cdn.example.com/post.jpg",
			MediaKind:    "image",
			OriginalName: "post.jpg",
		}},
	)
	if err != nil {
		t.Fatalf("PublishPost() error = %v", err)
	}
	if publishAttempts != 2 {
		t.Fatalf("media_publish attempts = %d, want 2", publishAttempts)
	}
	if got := result.ExternalPostID; got != "published-456" {
		t.Fatalf("ExternalPostID = %q, want %q", got, "published-456")
	}
	if got := stringValue(result.Metadata["externalPostUrl"]); got != "https://www.instagram.com/p/test/" {
		t.Fatalf("externalPostUrl = %q, want permalink", got)
	}
}

func TestInstagramMediaNotReadyErrorMatcher(t *testing.T) {
	if !isInstagramMediaNotReadyError(errors.New("provider request failed (400): {\"error\":{\"message\":\"Media ID is not available\",\"type\":\"OAuthException\",\"code\":9007,\"error_subcode\":2207027,\"error_user_title\":\"Cannot Publish\",\"error_user_msg\":\"The media is not ready for publishing, please wait for a moment\"}}")) {
		t.Fatal("isInstagramMediaNotReadyError() = false, want true")
	}
}
