package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all application configuration
type Config struct {
	Environment string
	API         APIConfig
	Database    DatabaseConfig
	Auth        AuthConfig
	Storage     StorageConfig
	Social      SocialConfig
	Bootstrap   BootstrapConfig
}

// APIConfig holds API server configuration
type APIConfig struct {
	Host           string
	Port           string
	Prefix         string
	AllowedOrigins []string
}

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
	URL            string
	MaxConnections int
	MaxIdleConns   int
}

// AuthConfig holds authentication settings.
type AuthConfig struct {
	JWTSecret          string
	AccessTokenTTL     time.Duration
	RefreshTokenTTL    time.Duration
	CustomerCookieName string
	PlatformCookieName string
	CookieSecure       bool
}

// StorageConfig holds resource storage and media processing settings.
type StorageConfig struct {
	Driver                  string
	LocalRoot               string
	MaxUploadSizeBytes      int64
	SignedURLTTL            time.Duration
	SignedURLSecret         string
	OptimizeImagesByDefault bool
}

// SocialConfig holds platform integration settings.
type SocialConfig struct {
	EncryptionKey        string
	OAuthStateTTL        time.Duration
	PublicAPIBaseURL     string
	PublicAssetBaseURL   string
	TempMediaProvider    string
	MetaClientID         string
	MetaClientSecret     string
	MetaAPIVersion       string
	LinkedInClientID     string
	LinkedInClientSecret string
	LinkedInVersion      string
	XClientID            string
	XClientSecret        string
	TikTokClientKey      string
	TikTokClientSecret   string
}

// BootstrapConfig holds first-admin bootstrap configuration.
type BootstrapConfig struct {
	AdminName     string
	AdminEmail    string
	AdminPassword string
}

// Load reads configuration from environment variables
func Load() *Config {
	return &Config{
		Environment: getEnv("GO_ENV", "development"),
		API: APIConfig{
			Host:           getEnv("API_HOST", "localhost"),
			Port:           getEnv("API_PORT", "18080"),
			Prefix:         getEnv("API_PREFIX", "/api/v1"),
			AllowedOrigins: getEnvCSV("API_ALLOWED_ORIGINS", []string{"http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"}),
		},
		Database: DatabaseConfig{
			URL:            getEnv("DATABASE_URL", "postgres://heimdall:heimdall@localhost:5432/heimdall?sslmode=disable"),
			MaxConnections: getEnvInt("DATABASE_MAX_CONNECTIONS", 25),
			MaxIdleConns:   getEnvInt("DATABASE_MAX_IDLE_CONNECTIONS", 5),
		},
		Auth: AuthConfig{
			JWTSecret:          getEnv("JWT_SECRET", "heimdall-local-dev-secret"),
			AccessTokenTTL:     getEnvDuration("JWT_ACCESS_TTL", 15*time.Minute),
			RefreshTokenTTL:    getEnvDuration("JWT_REFRESH_TTL", 30*24*time.Hour),
			CustomerCookieName: getEnv("AUTH_CUSTOMER_REFRESH_COOKIE", "heimdall_customer_refresh"),
			PlatformCookieName: getEnv("AUTH_PLATFORM_REFRESH_COOKIE", "heimdall_platform_refresh"),
			CookieSecure:       getEnvBool("AUTH_COOKIE_SECURE", false),
		},
		Storage: StorageConfig{
			Driver:                  getEnv("STORAGE_DRIVER", "local"),
			LocalRoot:               getEnv("STORAGE_LOCAL_ROOT", "./tmp/storage"),
			MaxUploadSizeBytes:      getEnvInt64("STORAGE_MAX_UPLOAD_BYTES", 1024*1024*512),
			SignedURLTTL:            getEnvDuration("STORAGE_SIGNED_URL_TTL", 15*time.Minute),
			SignedURLSecret:         getEnv("STORAGE_SIGNED_URL_SECRET", getEnv("JWT_SECRET", "heimdall-local-dev-secret")),
			OptimizeImagesByDefault: getEnvBool("STORAGE_OPTIMIZE_IMAGES_BY_DEFAULT", true),
		},
		Social: SocialConfig{
			EncryptionKey:        getEnv("SOCIAL_ENCRYPTION_KEY", getEnv("JWT_SECRET", "heimdall-local-dev-secret")),
			OAuthStateTTL:        getEnvDuration("SOCIAL_OAUTH_STATE_TTL", 15*time.Minute),
			PublicAPIBaseURL:     getEnv("SOCIAL_PUBLIC_API_BASE_URL", "http://localhost:18080"),
			PublicAssetBaseURL:   getEnv("SOCIAL_PUBLIC_ASSET_BASE_URL", "http://localhost:18080"),
			TempMediaProvider:    getEnv("SOCIAL_TEMP_MEDIA_PROVIDER", ""),
			MetaClientID:         getEnv("META_CLIENT_ID", getEnv("FACEBOOK_APP_ID", "")),
			MetaClientSecret:     getEnv("META_CLIENT_SECRET", getEnv("FACEBOOK_APP_SECRET", "")),
			MetaAPIVersion:       getEnv("META_API_VERSION", "v23.0"),
			LinkedInClientID:     getEnv("LINKEDIN_CLIENT_ID", ""),
			LinkedInClientSecret: getEnv("LINKEDIN_CLIENT_SECRET", ""),
			LinkedInVersion:      getEnv("LINKEDIN_VERSION", "202503"),
			XClientID:            getEnv("X_CLIENT_ID", ""),
			XClientSecret:        getEnv("X_CLIENT_SECRET", ""),
			TikTokClientKey:      getEnv("TIKTOK_CLIENT_KEY", ""),
			TikTokClientSecret:   getEnv("TIKTOK_CLIENT_SECRET", ""),
		},
		Bootstrap: BootstrapConfig{
			AdminName:     getEnv("BOOTSTRAP_ADMIN_NAME", "System Admin"),
			AdminEmail:    getEnv("BOOTSTRAP_ADMIN_EMAIL", ""),
			AdminPassword: getEnv("BOOTSTRAP_ADMIN_PASSWORD", ""),
		},
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func getEnvInt64(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.ParseInt(value, 10, 64); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		parsed, err := strconv.ParseBool(value)
		if err == nil {
			return parsed
		}
	}
	return defaultValue
}

func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		parsed, err := time.ParseDuration(value)
		if err == nil {
			return parsed
		}
	}
	return defaultValue
}

func getEnvCSV(key string, defaultValue []string) []string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return defaultValue
	}

	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	if len(result) == 0 {
		return defaultValue
	}
	return result
}
