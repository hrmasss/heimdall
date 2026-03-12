package resources

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

type fileMetadata struct {
	MediaKind      string
	MIMEType       string
	Extension      string
	SizeBytes      int64
	ChecksumSHA256 string
	WidthPx        *int
	HeightPx       *int
	PageCount      *int
	Optimized      bool
}

type optimizationResult struct {
	Applied           bool  `json:"applied"`
	OriginalSizeBytes int64 `json:"originalSizeBytes"`
	StoredSizeBytes   int64 `json:"storedSizeBytes"`
	SavedBytes        int64 `json:"savedBytes"`
}

func detectMIMEType(sniffed []byte, originalName, providedContentType string) string {
	if providedContentType != "" && providedContentType != "application/octet-stream" {
		return providedContentType
	}
	detected := http.DetectContentType(sniffed)
	if detected != "application/octet-stream" {
		return detected
	}
	switch strings.ToLower(filepath.Ext(originalName)) {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".mp4":
		return "video/mp4"
	case ".mov":
		return "video/quicktime"
	case ".webm":
		return "video/webm"
	case ".pdf":
		return "application/pdf"
	case ".doc":
		return "application/msword"
	case ".docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case ".ppt":
		return "application/vnd.ms-powerpoint"
	case ".pptx":
		return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
	default:
		return detected
	}
}

func mediaKindFromMIME(mimeType string) string {
	switch {
	case strings.HasPrefix(mimeType, "image/"):
		return "image"
	case strings.HasPrefix(mimeType, "video/"):
		return "video"
	case strings.HasPrefix(mimeType, "application/"):
		return "document"
	default:
		return ""
	}
}

func extensionForFile(originalName, mimeType string) string {
	ext := strings.ToLower(filepath.Ext(originalName))
	if ext != "" {
		return ext
	}
	extensions, err := mime.ExtensionsByType(mimeType)
	if err == nil && len(extensions) > 0 {
		return strings.ToLower(extensions[0])
	}
	return ""
}

func extractFileMetadata(path, originalName, mimeType string, optimize bool) (string, fileMetadata, *optimizationResult, error) {
	info, err := os.Stat(path)
	if err != nil {
		return "", fileMetadata{}, nil, err
	}
	metadata := fileMetadata{
		MediaKind: mediaKindFromMIME(mimeType),
		MIMEType:  mimeType,
		Extension: extensionForFile(originalName, mimeType),
		SizeBytes: info.Size(),
	}
	if metadata.MediaKind == "" {
		return "", fileMetadata{}, nil, fmt.Errorf("unsupported media type")
	}

	finalPath := path
	var optimization *optimizationResult
	if metadata.MediaKind == "image" {
		width, height, optimizedPath, optimized, optErr := extractAndMaybeOptimizeImage(path, mimeType, optimize)
		if optErr != nil {
			return "", fileMetadata{}, nil, optErr
		}
		metadata.WidthPx = &width
		metadata.HeightPx = &height
		if optimizedPath != "" {
			finalPath = optimizedPath
			finalInfo, err := os.Stat(finalPath)
			if err != nil {
				return "", fileMetadata{}, nil, err
			}
			metadata.SizeBytes = finalInfo.Size()
			metadata.Optimized = optimized
			optimization = &optimizationResult{
				Applied:           optimized,
				OriginalSizeBytes: info.Size(),
				StoredSizeBytes:   finalInfo.Size(),
				SavedBytes:        info.Size() - finalInfo.Size(),
			}
		}
	}
	if metadata.MediaKind == "document" && mimeType == "application/pdf" {
		if pageCount, countErr := countPDFPages(finalPath); countErr == nil {
			metadata.PageCount = &pageCount
		}
	}

	checksum, err := checksumFile(finalPath)
	if err != nil {
		return "", fileMetadata{}, nil, err
	}
	metadata.ChecksumSHA256 = checksum
	return finalPath, metadata, optimization, nil
}

func extractAndMaybeOptimizeImage(path, mimeType string, optimize bool) (int, int, string, bool, error) {
	file, err := os.Open(path)
	if err != nil {
		return 0, 0, "", false, err
	}
	defer file.Close()

	cfg, _, err := image.DecodeConfig(file)
	if err != nil {
		return 0, 0, "", false, err
	}
	if !optimize || (mimeType != "image/jpeg" && mimeType != "image/png") {
		return cfg.Width, cfg.Height, "", false, nil
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return 0, 0, "", false, err
	}
	img, _, err := image.Decode(file)
	if err != nil {
		return 0, 0, "", false, err
	}

	output, err := os.CreateTemp("", "heimdall-image-*")
	if err != nil {
		return 0, 0, "", false, err
	}
	defer output.Close()

	switch mimeType {
	case "image/jpeg":
		err = jpeg.Encode(output, img, &jpeg.Options{Quality: 82})
	case "image/png":
		encoder := png.Encoder{CompressionLevel: png.BestCompression}
		err = encoder.Encode(output, img)
	}
	if err != nil {
		return 0, 0, "", false, err
	}

	originalInfo, err := os.Stat(path)
	if err != nil {
		return 0, 0, "", false, err
	}
	optimizedInfo, err := os.Stat(output.Name())
	if err != nil {
		return 0, 0, "", false, err
	}
	if optimizedInfo.Size() >= originalInfo.Size() {
		_ = os.Remove(output.Name())
		return cfg.Width, cfg.Height, "", false, nil
	}
	return cfg.Width, cfg.Height, output.Name(), true, nil
}

func checksumFile(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func countPDFPages(path string) (int, error) {
	file, err := os.Open(path)
	if err != nil {
		return 0, err
	}
	defer file.Close()
	reader := bufio.NewReader(file)
	count := 0
	for {
		line, err := reader.ReadString('\n')
		if strings.Contains(line, "/Type /Page") && !strings.Contains(line, "/Type /Pages") {
			count++
		}
		if err != nil {
			if err == io.EOF {
				break
			}
			return 0, err
		}
	}
	if count == 0 {
		return 0, fmt.Errorf("unable to determine pdf page count")
	}
	return count, nil
}

func mimeTypeFromExtension(ext string) string {
	if ext == "" {
		return "application/octet-stream"
	}
	if mimeType := mime.TypeByExtension(ext); mimeType != "" {
		return mimeType
	}
	return "application/octet-stream"
}
