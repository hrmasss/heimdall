package resources

import (
	"context"
	"image"
	"image/color"
	"image/jpeg"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/heimdall/api/internal/database"
)

func TestLocalStorageSignedURLRoundTrip(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	storage, err := NewLocalStorage(rootDir, "test-secret")
	if err != nil {
		t.Fatalf("NewLocalStorage() error = %v", err)
	}

	ctx := context.Background()
	key := filepath.ToSlash(filepath.Join("workspaces", uuid.NewString(), "hello.txt"))
	if err := storage.Put(ctx, key, strings.NewReader("hello world")); err != nil {
		t.Fatalf("Put() error = %v", err)
	}

	signedURL, err := storage.SignedURL(ctx, key, SignedURLOptions{
		Filename:  "hello.txt",
		ExpiresIn: time.Minute,
	})
	if err != nil {
		t.Fatalf("SignedURL() error = %v", err)
	}
	parsed, err := url.Parse(signedURL)
	if err != nil {
		t.Fatalf("url.Parse() error = %v", err)
	}
	expiresUnix, err := strconv.ParseInt(parsed.Query().Get("expires"), 10, 64)
	if err != nil {
		t.Fatalf("ParseInt() error = %v", err)
	}
	encodedKey := strings.TrimPrefix(parsed.Path, localBlobRoutePrefix+"/")

	blob, err := storage.OpenSigned(ctx, encodedKey, parsed.Query().Get("filename"), expiresUnix, parsed.Query().Get("sig"))
	if err != nil {
		t.Fatalf("OpenSigned() error = %v", err)
	}
	defer blob.Reader.Close()

	body, err := io.ReadAll(blob.Reader)
	if err != nil {
		t.Fatalf("ReadAll() error = %v", err)
	}
	if string(body) != "hello world" {
		t.Fatalf("expected round-tripped content, got %q", string(body))
	}
}

func TestExtractFileMetadataJPEGOptimization(t *testing.T) {
	t.Parallel()

	tempFile, err := os.CreateTemp("", "resource-image-*.jpg")
	if err != nil {
		t.Fatalf("CreateTemp() error = %v", err)
	}
	defer os.Remove(tempFile.Name())
	defer tempFile.Close()

	img := image.NewRGBA(image.Rect(0, 0, 300, 220))
	for y := 0; y < 220; y++ {
		for x := 0; x < 300; x++ {
			img.Set(x, y, color.RGBA{R: uint8((x * y) % 255), G: uint8((x * 3) % 255), B: uint8((y * 5) % 255), A: 255})
		}
	}
	if err := jpeg.Encode(tempFile, img, &jpeg.Options{Quality: 100}); err != nil {
		t.Fatalf("jpeg.Encode() error = %v", err)
	}

	finalPath, metadata, optimization, err := extractFileMetadata(tempFile.Name(), "sample.jpg", "image/jpeg", true)
	if err != nil {
		t.Fatalf("extractFileMetadata() error = %v", err)
	}
	if finalPath == "" {
		t.Fatalf("expected a final path")
	}
	if metadata.MediaKind != "image" {
		t.Fatalf("expected image media kind, got %q", metadata.MediaKind)
	}
	if metadata.WidthPx == nil || *metadata.WidthPx != 300 {
		t.Fatalf("expected width metadata to be populated, got %#v", metadata.WidthPx)
	}
	if metadata.HeightPx == nil || *metadata.HeightPx != 220 {
		t.Fatalf("expected height metadata to be populated, got %#v", metadata.HeightPx)
	}
	if optimization == nil {
		t.Fatalf("expected optimization result")
	}
}

func TestEvaluateCompatibilityFlagsOversizedXImage(t *testing.T) {
	t.Parallel()

	resource := database.Resource{
		ID:         uuid.New(),
		MediaKind:  "image",
		MIMEType:   "image/jpeg",
		SizeBytes:  6 * 1024 * 1024,
		WidthPx:    intPtr(1200),
		HeightPx:   intPtr(630),
		CreatedAt:  time.Now().UTC(),
		UpdatedAt:  time.Now().UTC(),
		StorageKey: "demo",
	}

	results := evaluateCompatibility(defaultCapabilityMatrix(), resource)
	for _, item := range results {
		if item.Platform == "x" && item.Surface == "image_post" {
			if item.Status != "unsupported" {
				t.Fatalf("expected unsupported status for oversized x image, got %q", item.Status)
			}
			return
		}
	}
	t.Fatalf("expected X image compatibility result")
}

func intPtr(value int) *int {
	return &value
}
