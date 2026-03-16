package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/joho/godotenv"

	"github.com/heimdall/api/internal/campaigns"
	"github.com/heimdall/api/internal/config"
	"github.com/heimdall/api/internal/database"
	"github.com/heimdall/api/internal/handlers"
	"github.com/heimdall/api/internal/iam"
	"github.com/heimdall/api/internal/posts"
	"github.com/heimdall/api/internal/resources"
	"github.com/heimdall/api/internal/social"
)

const (
	commandServe      = "serve"
	commandMigrate    = "migrate"
	commandSeedSystem = "seed-system"
	commandHealth     = "healthcheck"
)

func main() {
	rootDir := findRootDir()
	if err := loadEnv(rootDir); err != nil {
		log.Printf("No .env file found, using environment variables: %v", err)
	}

	command := resolveCommand(os.Args[1:])
	switch command {
	case commandServe:
		if err := runServe(rootDir); err != nil {
			log.Fatalf("serve failed: %v", err)
		}
	case commandMigrate:
		if err := runMigrate(rootDir); err != nil {
			log.Fatalf("migrate failed: %v", err)
		}
	case commandSeedSystem:
		if err := runSeedSystem(); err != nil {
			log.Fatalf("seed-system failed: %v", err)
		}
	case commandHealth:
		if err := runHealthcheck(rootDir); err != nil {
			log.Fatalf("healthcheck failed: %v", err)
		}
	default:
		log.Fatalf("unknown command %q", command)
	}
}

func resolveCommand(args []string) string {
	if len(args) == 0 {
		return commandServe
	}

	switch strings.TrimSpace(args[0]) {
	case "", commandServe:
		return commandServe
	case commandMigrate:
		return commandMigrate
	case commandSeedSystem:
		return commandSeedSystem
	case commandHealth:
		return commandHealth
	default:
		return args[0]
	}
}

func runServe(rootDir string) error {
	cfg := config.Load()
	deps, err := openDependencies(rootDir, cfg)
	if err != nil {
		return err
	}
	defer deps.cleanup()

	app := fiber.New(fiber.Config{
		AppName:      "Heimdall API v0.1.0",
		ServerHeader: "Heimdall",
		BodyLimit:    int(cfg.Storage.MaxUploadSizeBytes),
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

	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${status} - ${latency} ${method} ${path}\n",
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.API.AllowedOrigins,
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Workspace-ID"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowCredentials: true,
	}))

	handlers.NewAppHandler(deps.service, deps.resourceService, deps.campaignService, deps.postService, deps.socialService, deps.storage, cfg).Register(app)

	addr := fmt.Sprintf("%s:%s", cfg.API.Host, cfg.API.Port)
	log.Printf("Heimdall API starting on http://%s", addr)
	log.Printf("API Reference available at http://%s/reference", addr)
	log.Printf("OpenAPI spec available at http://%s/openapi.yaml", addr)
	return app.Listen(addr)
}

func runMigrate(rootDir string) error {
	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if databaseURL == "" {
		return fmt.Errorf("DATABASE_URL is required for migrations")
	}

	cmd := exec.Command(
		"atlas",
		"migrate",
		"apply",
		"--dir", "file://db/migrations",
		"--url", databaseURL,
		"--tx-mode", "file",
		"--exec-order", "linear",
	)
	cmd.Dir = rootDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = os.Environ()
	return cmd.Run()
}

func runSeedSystem() error {
	cfg := config.Load()
	db, err := database.Open(cfg.Database)
	if err != nil {
		return fmt.Errorf("connect database: %w", err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	return iam.NewService(db, cfg).SeedSystem(ctx)
}

func runHealthcheck(rootDir string) error {
	cfg := config.Load()
	db, err := database.Open(cfg.Database)
	if err != nil {
		return fmt.Errorf("connect database: %w", err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := iam.NewService(db, cfg).CheckHealth(ctx); err != nil {
		return err
	}
	return resources.CheckLocalStorage(resolveStorageRoot(rootDir, cfg.Storage.LocalRoot))
}

type appDependencies struct {
	service         *iam.Service
	resourceService *resources.Service
	campaignService *campaigns.Service
	postService     *posts.Service
	socialService   *social.Service
	storage         *resources.LocalStorage
	cleanup         func()
}

func openDependencies(rootDir string, cfg *config.Config) (*appDependencies, error) {
	db, err := database.Open(cfg.Database)
	if err != nil {
		return nil, fmt.Errorf("connect database: %w", err)
	}

	storage, err := resources.NewLocalStorage(resolveStorageRoot(rootDir, cfg.Storage.LocalRoot), cfg.Storage.SignedURLSecret)
	if err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("configure resource storage: %w", err)
	}

	service := iam.NewService(db, cfg)
	if _, err := service.CheckHealth(context.Background()); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("validate database readiness: %w", err)
	}
	resourceService := resources.NewService(db, cfg.Storage, storage, service)
	postService := posts.NewService(db, service, resourceService)
	campaignService := campaigns.NewService(db, service, postService)
	socialService := social.NewService(db, cfg.Social, service, postService, storage)

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	if err := resourceService.RunCleanupSweep(ctx); err != nil {
		log.Printf("Resource cleanup sweep failed during startup: %v", err)
	}

	return &appDependencies{
		service:         service,
		resourceService: resourceService,
		campaignService: campaignService,
		postService:     postService,
		socialService:   socialService,
		storage:         storage,
		cleanup: func() {
			_ = db.Close()
		},
	}, nil
}

func loadEnv(rootDir string) error {
	return godotenv.Load(filepath.Join(rootDir, ".env"))
}

func resolveStorageRoot(rootDir, localRoot string) string {
	if filepath.IsAbs(localRoot) {
		return localRoot
	}
	return filepath.Join(rootDir, localRoot)
}

func findRootDir() string {
	dir, err := os.Getwd()
	if err != nil {
		return "."
	}

	for {
		if _, err := os.Stat(filepath.Join(dir, ".env")); err == nil {
			return dir
		}
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
