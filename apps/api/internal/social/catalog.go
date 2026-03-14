package social

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"strings"

	"github.com/heimdall/api/internal/config"
)

const (
	credentialSourceManaged = "managed"
	credentialSourceBYOK    = "byok"

	connectionStatusConnected = "connected"
	targetStatusHealthy       = "healthy"
	targetStatusDegraded      = "degraded"
	targetStatusReauth        = "reauth_required"
	targetStatusRevoked       = "revoked"
)

func maskClientID(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if len(value) <= 6 {
		return value
	}
	return fmt.Sprintf("%s...%s", value[:4], value[len(value)-2:])
}

func secretHint(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if len(value) <= 4 {
		return strings.Repeat("*", len(value))
	}
	return fmt.Sprintf("%s%s", strings.Repeat("*", len(value)-4), value[len(value)-4:])
}

func randomToken(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func pkceChallenge(verifier string) string {
	hash := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(hash[:])
}

func managedProviderCredential(cfg config.SocialConfig, provider string) (providerCredential, bool) {
	switch provider {
	case "meta":
		if strings.TrimSpace(cfg.MetaClientID) == "" || strings.TrimSpace(cfg.MetaClientSecret) == "" {
			return providerCredential{}, false
		}
		return providerCredential{
			Provider:     provider,
			Source:       credentialSourceManaged,
			ClientID:     cfg.MetaClientID,
			ClientSecret: cfg.MetaClientSecret,
		}, true
	case "linkedin":
		if strings.TrimSpace(cfg.LinkedInClientID) == "" || strings.TrimSpace(cfg.LinkedInClientSecret) == "" {
			return providerCredential{}, false
		}
		return providerCredential{
			Provider:     provider,
			Source:       credentialSourceManaged,
			ClientID:     cfg.LinkedInClientID,
			ClientSecret: cfg.LinkedInClientSecret,
		}, true
	case "x":
		if strings.TrimSpace(cfg.XClientID) == "" || strings.TrimSpace(cfg.XClientSecret) == "" {
			return providerCredential{}, false
		}
		return providerCredential{
			Provider:     provider,
			Source:       credentialSourceManaged,
			ClientID:     cfg.XClientID,
			ClientSecret: cfg.XClientSecret,
		}, true
	default:
		return providerCredential{}, false
	}
}
