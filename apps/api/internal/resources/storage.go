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
	OpenSigned(ctx context.Context, encodedKey, filename string, expiresUnix int64, sig string) (*SignedBlob, error)
}
