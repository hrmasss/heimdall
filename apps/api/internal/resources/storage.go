package resources

import (
	"context"
	"io"
	"time"
)

type SignedURLOptions struct {
	Filename    string
	ContentType string
	ExpiresIn   time.Duration
	Width       int // Optional thumbnail width (0 = original)
}

// AllowedThumbnailWidths defines valid thumbnail sizes to prevent abuse
var AllowedThumbnailWidths = map[int]bool{
	200: true,
	400: true,
	800: true,
}

type BlobStat struct {
	Size int64
}

type Storage interface {
	Put(ctx context.Context, key string, body io.Reader) error
	Delete(ctx context.Context, key string) error
	Open(ctx context.Context, key string) (io.ReadCloser, error)
	Stat(ctx context.Context, key string) (BlobStat, error)
	SignedURL(ctx context.Context, key string, options SignedURLOptions) (string, error)
}

type SignedBlob struct {
	Filename    string
	ContentType string
	Size        int64
	Reader      io.ReadCloser
}

type SignedBlobServer interface {
	OpenSigned(ctx context.Context, encodedKey, filename string, expiresUnix int64, sig string, width int) (*SignedBlob, error)
}
