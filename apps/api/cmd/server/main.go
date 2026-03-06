package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/joho/godotenv"

	"github.com/heimdall/api/internal/handlers"
)

func main() {
	// Load .env from root directory
	rootDir := findRootDir()
	if err := godotenv.Load(filepath.Join(rootDir, ".env")); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Get configuration
	port := getEnv("API_PORT", "8080")
	host := getEnv("API_HOST", "localhost")

	// Create Fiber app
	app := fiber.New(fiber.Config{
		AppName:      "Heimdall API v0.1.0",
		ServerHeader: "Heimdall",
		ErrorHandler: func(c fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{
				"error":   true,
				"message": err.Error(),
			})
		},
	})

	// Middleware
	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${status} - ${latency} ${method} ${path}\n",
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins: []string{"http://localhost:5173", "http://localhost:3000"},
		AllowHeaders: []string{"Origin", "Content-Type", "Accept", "Authorization"},
		AllowMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
	}))

	// Register routes
	registerRoutes(app)

	// Start server
	addr := fmt.Sprintf("%s:%s", host, port)
	log.Printf("🚀 Heimdall API starting on http://%s", addr)
	log.Printf("📚 API Reference available at http://%s/reference", addr)
	log.Printf("📄 OpenAPI spec available at http://%s/openapi.yaml", addr)

	if err := app.Listen(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func registerRoutes(app *fiber.App) {
	// Serve OpenAPI spec
	app.Get("/openapi.yaml", handlers.ServeOpenAPISpec)

	// Serve Scalar API Reference
	app.Get("/reference", handlers.ServeScalarReference)

	// API v1 routes
	api := app.Group("/api/v1")

	// Health check
	api.Get("/health", handlers.HealthCheck)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func findRootDir() string {
	// Start from current directory and walk up to find .env or root markers
	dir, err := os.Getwd()
	if err != nil {
		return "."
	}

	for {
		// Check if .env exists in this directory
		if _, err := os.Stat(filepath.Join(dir, ".env")); err == nil {
			return dir
		}
		// Check for package.json as root marker
		if _, err := os.Stat(filepath.Join(dir, "package.json")); err == nil {
			return dir
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	return "."
}
