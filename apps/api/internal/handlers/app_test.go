package handlers

import (
	"context"
	"errors"
	"io"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v3"

	"github.com/heimdall/api/internal/resources"
)

func TestServeResourceBlobStreamsBody(t *testing.T) {
	t.Parallel()

	const payload = "blob-payload"

	app := fiber.New()
	handler := NewAppHandler(nil, nil, stubSignedBlobServer{
		blob: &resources.SignedBlob{
			Filename:    "sample.txt",
			ContentType: "text/plain",
			Size:        int64(len(payload)),
			Reader:      &trackingReadCloser{payload: []byte(payload)},
		},
	}, nil)
	handler.Register(app)

	req := httptest.NewRequest("GET", "/api/v1/resource-blobs/test-key?expires=9999999999&filename=sample.txt&sig=test-sig", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("reading response body: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}
	if got := string(body); got != payload {
		t.Fatalf("expected body %q, got %q", payload, got)
	}
	if got := resp.Header.Get("Content-Type"); got != "text/plain" {
		t.Fatalf("expected content type text/plain, got %q", got)
	}
}

type stubSignedBlobServer struct {
	blob *resources.SignedBlob
	err  error
}

func (s stubSignedBlobServer) OpenSigned(context.Context, string, string, int64, string) (*resources.SignedBlob, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.blob, nil
}

type trackingReadCloser struct {
	payload []byte
	offset  int
	closed  bool
}

func (r *trackingReadCloser) Read(p []byte) (int, error) {
	if r.closed {
		return 0, errors.New("read after close")
	}
	if r.offset >= len(r.payload) {
		return 0, io.EOF
	}
	n := copy(p, r.payload[r.offset:])
	r.offset += n
	return n, nil
}

func (r *trackingReadCloser) Close() error {
	r.closed = true
	return nil
}
