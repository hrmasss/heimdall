package resources

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const localBlobRoutePrefix = "/api/v1/resource-blobs"

type LocalStorage struct {
	rootDir string
	secret  []byte
}

func NewLocalStorage(rootDir, secret string) (*LocalStorage, error) {
	if strings.TrimSpace(rootDir) == "" {
		return nil, fmt.Errorf("local storage root is required")
	}
	if err := os.MkdirAll(rootDir, 0o755); err != nil {
		return nil, err
	}
	return &LocalStorage{
		rootDir: rootDir,
		secret:  []byte(secret),
	}, nil
}

func CheckLocalStorage(rootDir string) error {
	if strings.TrimSpace(rootDir) == "" {
		return fmt.Errorf("local storage root is required")
	}
	if err := os.MkdirAll(rootDir, 0o755); err != nil {
		return err
	}

	file, err := os.CreateTemp(rootDir, ".healthcheck-*")
	if err != nil {
		return err
	}
	name := file.Name()
	if _, err := file.WriteString("ok"); err != nil {
		file.Close()
		_ = os.Remove(name)
		return err
	}
	if err := file.Close(); err != nil {
		_ = os.Remove(name)
		return err
	}
	return os.Remove(name)
}

func (s *LocalStorage) Put(_ context.Context, key string, body io.Reader) error {
	path, err := s.pathForKey(key)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()
	_, err = io.Copy(file, body)
	return err
}

func (s *LocalStorage) Delete(_ context.Context, key string) error {
	path, err := s.pathForKey(key)
	if err != nil {
		return err
	}
	err = os.Remove(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}

func (s *LocalStorage) Open(_ context.Context, key string) (io.ReadCloser, error) {
	path, err := s.pathForKey(key)
	if err != nil {
		return nil, err
	}
	return os.Open(path)
}

func (s *LocalStorage) Stat(_ context.Context, key string) (BlobStat, error) {
	path, err := s.pathForKey(key)
	if err != nil {
		return BlobStat{}, err
	}
	info, err := os.Stat(path)
	if err != nil {
		return BlobStat{}, err
	}
	return BlobStat{Size: info.Size()}, nil
}

func (s *LocalStorage) SignedURL(_ context.Context, key string, options SignedURLOptions) (string, error) {
	expiresUnix := time.Now().UTC().Add(options.ExpiresIn).Unix()
	encodedKey := base64.RawURLEncoding.EncodeToString([]byte(key))
	signature := s.sign(key, options.Filename, expiresUnix)
	return fmt.Sprintf(
		"%s/%s?expires=%s&filename=%s&sig=%s",
		localBlobRoutePrefix,
		encodedKey,
		url.QueryEscape(strconv.FormatInt(expiresUnix, 10)),
		url.QueryEscape(options.Filename),
		url.QueryEscape(signature),
	), nil
}

func (s *LocalStorage) OpenSigned(ctx context.Context, encodedKey, filename string, expiresUnix int64, sig string) (*SignedBlob, error) {
	if time.Now().UTC().Unix() > expiresUnix {
		return nil, fmt.Errorf("signed url expired")
	}
	keyBytes, err := base64.RawURLEncoding.DecodeString(encodedKey)
	if err != nil {
		return nil, fmt.Errorf("invalid blob key")
	}
	key := string(keyBytes)
	if !hmac.Equal([]byte(sig), []byte(s.sign(key, filename, expiresUnix))) {
		return nil, fmt.Errorf("invalid blob signature")
	}
	reader, err := s.Open(ctx, key)
	if err != nil {
		return nil, err
	}
	stat, err := s.Stat(ctx, key)
	if err != nil {
		reader.Close()
		return nil, err
	}
	return &SignedBlob{
		Filename:    filename,
		ContentType: mimeTypeFromExtension(filepath.Ext(filename)),
		Size:        stat.Size,
		Reader:      reader,
	}, nil
}

func (s *LocalStorage) pathForKey(key string) (string, error) {
	cleaned := filepath.Clean(key)
	if cleaned == "." || strings.HasPrefix(cleaned, "..") || filepath.IsAbs(cleaned) {
		return "", fmt.Errorf("invalid storage key")
	}
	return filepath.Join(s.rootDir, cleaned), nil
}

func (s *LocalStorage) sign(key, filename string, expiresUnix int64) string {
	mac := hmac.New(sha256.New, s.secret)
	_, _ = mac.Write([]byte(key))
	_, _ = mac.Write([]byte("\n"))
	_, _ = mac.Write([]byte(filename))
	_, _ = mac.Write([]byte("\n"))
	_, _ = mac.Write([]byte(strconv.FormatInt(expiresUnix, 10)))
	return hex.EncodeToString(mac.Sum(nil))
}
