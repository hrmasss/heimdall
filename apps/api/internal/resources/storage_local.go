package resources

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	_ "image/gif"  // register gif decoder
	_ "image/png"  // register png decoder

	_ "golang.org/x/image/webp" // register webp decoder
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
	signature := s.sign(key, options.Filename, expiresUnix, options.Width)

	urlStr := fmt.Sprintf(
		"%s/%s?expires=%s&filename=%s&sig=%s",
		localBlobRoutePrefix,
		encodedKey,
		url.QueryEscape(strconv.FormatInt(expiresUnix, 10)),
		url.QueryEscape(options.Filename),
		url.QueryEscape(signature),
	)

	// Add width parameter if specified and valid
	if options.Width > 0 && AllowedThumbnailWidths[options.Width] {
		urlStr += "&w=" + strconv.Itoa(options.Width)
	}

	return urlStr, nil
}

func (s *LocalStorage) OpenSigned(ctx context.Context, encodedKey, filename string, expiresUnix int64, sig string, width int) (*SignedBlob, error) {
	if time.Now().UTC().Unix() > expiresUnix {
		return nil, fmt.Errorf("signed url expired")
	}
	keyBytes, err := base64.RawURLEncoding.DecodeString(encodedKey)
	if err != nil {
		return nil, fmt.Errorf("invalid blob key")
	}
	key := string(keyBytes)
	if !hmac.Equal([]byte(sig), []byte(s.sign(key, filename, expiresUnix, width))) {
		return nil, fmt.Errorf("invalid blob signature")
	}

	// If width is requested and valid, try to serve/generate thumbnail
	if width > 0 && AllowedThumbnailWidths[width] {
		contentType := mimeTypeFromExtension(filepath.Ext(filename))
		if strings.HasPrefix(contentType, "image/") {
			return s.openThumbnail(ctx, key, filename, width)
		}
	}

	// Serve original file
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

func (s *LocalStorage) openThumbnail(ctx context.Context, key, filename string, width int) (*SignedBlob, error) {
	thumbKey := s.thumbnailKey(key, width)

	// Check if thumbnail already exists (cached)
	if reader, err := s.Open(ctx, thumbKey); err == nil {
		stat, statErr := s.Stat(ctx, thumbKey)
		if statErr == nil {
			return &SignedBlob{
				Filename:    filename,
				ContentType: "image/jpeg",
				Size:        stat.Size,
				Reader:      reader,
			}, nil
		}
		reader.Close()
	}

	// Generate thumbnail from original
	originalPath, err := s.pathForKey(key)
	if err != nil {
		return nil, err
	}

	thumbPath, err := s.pathForKey(thumbKey)
	if err != nil {
		return nil, err
	}

	// Ensure thumbnail directory exists
	if err := os.MkdirAll(filepath.Dir(thumbPath), 0o755); err != nil {
		return nil, err
	}

	// Generate the thumbnail
	if err := generateThumbnail(originalPath, thumbPath, width); err != nil {
		// If thumbnail generation fails, fall back to original
		reader, openErr := s.Open(ctx, key)
		if openErr != nil {
			return nil, err
		}
		stat, statErr := s.Stat(ctx, key)
		if statErr != nil {
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

	// Open and return the generated thumbnail
	reader, err := s.Open(ctx, thumbKey)
	if err != nil {
		return nil, err
	}
	stat, err := s.Stat(ctx, thumbKey)
	if err != nil {
		reader.Close()
		return nil, err
	}
	return &SignedBlob{
		Filename:    filename,
		ContentType: "image/jpeg",
		Size:        stat.Size,
		Reader:      reader,
	}, nil
}

func (s *LocalStorage) thumbnailKey(key string, width int) string {
	dir := filepath.Dir(key)
	base := filepath.Base(key)
	ext := filepath.Ext(base)
	name := strings.TrimSuffix(base, ext)
	return filepath.Join(dir, ".thumbs", fmt.Sprintf("%s_w%d.jpg", name, width))
}

func generateThumbnail(srcPath, dstPath string, targetWidth int) error {
	srcFile, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	img, _, err := image.Decode(srcFile)
	if err != nil {
		return err
	}

	bounds := img.Bounds()
	srcWidth := bounds.Dx()
	srcHeight := bounds.Dy()

	// Don't upscale - if image is smaller than target, return error to fall back to original
	if srcWidth <= targetWidth {
		return fmt.Errorf("image too small for thumbnail")
	}

	// Calculate new height maintaining aspect ratio
	ratio := float64(targetWidth) / float64(srcWidth)
	newHeight := int(float64(srcHeight) * ratio)

	// Resize using simple nearest-neighbor (fast, good enough for thumbnails)
	resized := resizeImage(img, targetWidth, newHeight)

	// Write thumbnail as JPEG
	dstFile, err := os.Create(dstPath)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	return jpeg.Encode(dstFile, resized, &jpeg.Options{Quality: 85})
}

// resizeImage performs a simple bilinear interpolation resize
func resizeImage(src image.Image, newWidth, newHeight int) image.Image {
	srcBounds := src.Bounds()
	srcW := srcBounds.Dx()
	srcH := srcBounds.Dy()

	dst := image.NewRGBA(image.Rect(0, 0, newWidth, newHeight))

	xRatio := float64(srcW) / float64(newWidth)
	yRatio := float64(srcH) / float64(newHeight)

	for y := 0; y < newHeight; y++ {
		for x := 0; x < newWidth; x++ {
			srcX := int(float64(x) * xRatio)
			srcY := int(float64(y) * yRatio)

			if srcX >= srcW {
				srcX = srcW - 1
			}
			if srcY >= srcH {
				srcY = srcH - 1
			}

			dst.Set(x, y, src.At(srcBounds.Min.X+srcX, srcBounds.Min.Y+srcY))
		}
	}

	return dst
}

func (s *LocalStorage) pathForKey(key string) (string, error) {
	cleaned := filepath.Clean(key)
	if cleaned == "." || strings.HasPrefix(cleaned, "..") || filepath.IsAbs(cleaned) {
		return "", fmt.Errorf("invalid storage key")
	}
	return filepath.Join(s.rootDir, cleaned), nil
}

func (s *LocalStorage) sign(key, filename string, expiresUnix int64, width int) string {
	mac := hmac.New(sha256.New, s.secret)
	_, _ = mac.Write([]byte(key))
	_, _ = mac.Write([]byte("\n"))
	_, _ = mac.Write([]byte(filename))
	_, _ = mac.Write([]byte("\n"))
	_, _ = mac.Write([]byte(strconv.FormatInt(expiresUnix, 10)))
	_, _ = mac.Write([]byte("\n"))
	_, _ = mac.Write([]byte(strconv.Itoa(width)))
	return hex.EncodeToString(mac.Sum(nil))
}
