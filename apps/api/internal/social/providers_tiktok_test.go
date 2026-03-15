package social

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/heimdall/api/internal/config"
	"github.com/heimdall/api/internal/database"
)

func TestTikTokBuildPreviewMetadata(t *testing.T) {
	restore := swapSocialHTTPClient(t, newTikTokTestServer(t, map[string]any{
		"/v2/post/publish/creator_info/query/": map[string]any{
			"data": map[string]any{
				"creator_username":            "heimdallsocial",
				"creator_nickname":            "Heimdall Social",
				"privacy_level_options":       []string{"SELF_ONLY"},
				"comment_disabled":            false,
				"duet_disabled":               true,
				"stitch_disabled":             true,
				"max_video_post_duration_sec": 300,
			},
			"error": map[string]any{"code": "ok"},
		},
	}))
	defer restore()

	adapter := newTikTokAdapter(config.SocialConfig{}).(*tikTokAdapter)
	metadata, issues, warnings, err := adapter.BuildPreviewMetadata(
		context.Background(),
		providerSession{
			AccessToken: "token",
			Credential: providerCredential{
				Source: credentialSourceManaged,
			},
		},
		database.SocialTarget{},
		publishContent{Platform: "tiktok", Surface: "video_post"},
		nil,
	)
	if err != nil {
		t.Fatalf("BuildPreviewMetadata() error = %v", err)
	}
	if len(issues) != 0 {
		t.Fatalf("BuildPreviewMetadata() issues = %v, want none", issues)
	}
	if len(warnings) != 1 || warnings[0].Code != "tiktok_private_only" {
		t.Fatalf("BuildPreviewMetadata() warnings = %v, want SELF_ONLY warning", warnings)
	}
	tiktokMetadata := parseJSONAnyMap(metadata["tiktok"])
	if got := stringValue(tiktokMetadata["creatorUsername"]); got != "heimdallsocial" {
		t.Fatalf("creatorUsername = %q, want %q", got, "heimdallsocial")
	}
	if got := tiktokMetadata["isSelfOnly"]; got != true {
		t.Fatalf("isSelfOnly = %v, want true", got)
	}
}

func TestTikTokPublishPostBlocksBYOKPhoto(t *testing.T) {
	restore := swapSocialHTTPClient(t, newTikTokTestServer(t, map[string]any{
		"/v2/post/publish/creator_info/query/": map[string]any{
			"data": map[string]any{
				"creator_username":      "heimdallsocial",
				"creator_nickname":      "Heimdall Social",
				"privacy_level_options": []string{"SELF_ONLY"},
			},
			"error": map[string]any{"code": "ok"},
		},
	}))
	defer restore()

	adapter := newTikTokAdapter(config.SocialConfig{}).(*tikTokAdapter)
	_, err := adapter.PublishPost(
		context.Background(),
		providerSession{
			AccessToken: "token",
			Credential: providerCredential{
				Source: credentialSourceBYOK,
			},
		},
		database.SocialTarget{ExternalAccountID: "acct"},
		publishContent{
			Platform: "tiktok",
			Surface:  "photo_post",
		},
		nil,
	)
	if err == nil || !strings.Contains(err.Error(), "Heimdall-managed app credentials") {
		t.Fatalf("PublishPost() error = %v, want BYOK photo block", err)
	}
}

func TestTikTokGetPostMetricsBackfillsPublicVideo(t *testing.T) {
	restore := swapSocialHTTPClient(t, newTikTokTestServer(t, map[string]any{
		"/v2/post/publish/status/fetch/": map[string]any{
			"data": map[string]any{
				"status":                      "PUBLISH_COMPLETE",
				"publicaly_available_post_id": []string{"735"},
			},
			"error": map[string]any{"code": "ok"},
		},
		"/v2/video/query/": map[string]any{
			"data": map[string]any{
				"videos": []map[string]any{{
					"id":            "735",
					"share_url":     "https://www.tiktok.com/@heimdall/video/735",
					"like_count":    12,
					"comment_count": 3,
					"share_count":   4,
					"view_count":    88,
				}},
			},
			"error": map[string]any{"code": "ok"},
		},
	}))
	defer restore()

	adapter := newTikTokAdapter(config.SocialConfig{}).(*tikTokAdapter)
	result, err := adapter.GetPostMetrics(
		context.Background(),
		providerSession{AccessToken: "token"},
		database.SocialTarget{},
		database.PostVariantPublication{
			Metadata: `{"publishId":"publish-123"}`,
		},
	)
	if err != nil {
		t.Fatalf("GetPostMetrics() error = %v", err)
	}
	if got := result.Metrics["likes"]; got != 12 {
		t.Fatalf("likes = %v, want 12", got)
	}
	if got := result.Metrics["video_views"]; got != 88 {
		t.Fatalf("video_views = %v, want 88", got)
	}
	if got := stringValue(result.Metadata["externalPostId"]); got != "735" {
		t.Fatalf("externalPostId = %q, want %q", got, "735")
	}
	if got := stringValue(result.Metadata["externalPostUrl"]); got == "" {
		t.Fatalf("externalPostUrl missing from metadata")
	}
}

func swapSocialHTTPClient(t *testing.T, server *httptest.Server) func() {
	t.Helper()
	previous := socialHTTPClient
	baseURL, err := url.Parse(server.URL)
	if err != nil {
		t.Fatalf("url.Parse() error = %v", err)
	}
	socialHTTPClient = &http.Client{
		Transport: roundTripRewrite{baseURL: baseURL},
	}
	return func() {
		socialHTTPClient = previous
		server.Close()
	}
}

type roundTripRewrite struct {
	baseURL *url.URL
}

func (r roundTripRewrite) RoundTrip(req *http.Request) (*http.Response, error) {
	req.URL.Scheme = r.baseURL.Scheme
	req.URL.Host = r.baseURL.Host
	return http.DefaultTransport.RoundTrip(req)
}

func newTikTokTestServer(t *testing.T, payloads map[string]any) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		payload, ok := payloads[r.URL.Path]
		if !ok {
			t.Fatalf("unexpected request path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(payload); err != nil {
			t.Fatalf("Encode() error = %v", err)
		}
	}))
}
