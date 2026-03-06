package config

import (
	"os"
	"strconv"
)

// Config holds all application configuration
type Config struct {
	Environment string
	API         APIConfig
	Database    DatabaseConfig
}

// APIConfig holds API server configuration
type APIConfig struct {
	Host   string
	Port   string
	Prefix string
}

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
	URL             string
	MaxConnections  int
	MaxIdleConns    int
}

// Load reads configuration from environment variables
func Load() *Config {
	return &Config{
		Environment: getEnv("GO_ENV", "development"),
		API: APIConfig{
			Host:   getEnv("API_HOST", "localhost"),
			Port:   getEnv("API_PORT", "8080"),
			Prefix: getEnv("API_PREFIX", "/api/v1"),
		},
		Database: DatabaseConfig{
			URL:            getEnv("DATABASE_URL", "postgres://heimdall:heimdall@localhost:5432/heimdall?sslmode=disable"),
			MaxConnections: getEnvInt("DATABASE_MAX_CONNECTIONS", 25),
			MaxIdleConns:   getEnvInt("DATABASE_MAX_IDLE_CONNECTIONS", 5),
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
