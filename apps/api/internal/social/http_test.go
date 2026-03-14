package social

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestPostFormReturnsProviderErrors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error":"nope"}`, http.StatusBadRequest)
	}))
	defer server.Close()

	_, err := postForm(context.Background(), server.URL, url.Values{"message": []string{"hello"}}, nil)
	if err == nil {
		t.Fatal("postForm() error = nil, want provider error")
	}
	if !strings.Contains(err.Error(), "provider request failed (400)") {
		t.Fatalf("postForm() error = %q, want provider request failure", err.Error())
	}
}
