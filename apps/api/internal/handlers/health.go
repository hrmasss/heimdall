package handlers

import (
	"context"
	"runtime"
	"time"

	"github.com/gofiber/fiber/v3"
)

var startTime = time.Now()

// HealthResponse represents the health check response
type HealthResponse struct {
	Status    string            `json:"status"`
	Timestamp string            `json:"timestamp"`
	Uptime    string            `json:"uptime"`
	Version   string            `json:"version"`
	Go        GoInfo            `json:"go"`
	Checks    map[string]string `json:"checks"`
}

// GoInfo contains Go runtime information
type GoInfo struct {
	Version    string `json:"version"`
	OS         string `json:"os"`
	Arch       string `json:"arch"`
	NumCPU     int    `json:"num_cpu"`
	Goroutines int    `json:"goroutines"`
}

// HealthCheck returns the health status of the API.
func (h *AppHandler) HealthCheck(c fiber.Ctx) error {
	uptime := time.Since(startTime)
	ctx, cancel := context.WithTimeout(c.Context(), 3*time.Second)
	defer cancel()

	checks, err := h.service.CheckHealth(ctx)
	status := "healthy"
	if err != nil {
		status = "degraded"
	}

	response := HealthResponse{
		Status:    status,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Uptime:    uptime.String(),
		Version:   "0.1.0",
		Go: GoInfo{
			Version:    runtime.Version(),
			OS:         runtime.GOOS,
			Arch:       runtime.GOARCH,
			NumCPU:     runtime.NumCPU(),
			Goroutines: runtime.NumGoroutine(),
		},
		Checks: checks,
	}

	if err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(response)
	}
	return c.JSON(response)
}
