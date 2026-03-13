package handlers

import (
	"bytes"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v3"
)

func TestBindCalendarQueryParsesRangeAndPlatforms(t *testing.T) {
	t.Parallel()

	app := fiber.New()
	app.Get("/calendar", func(c fiber.Ctx) error {
		input, err := bindCalendarQuery(c)
		if err != nil {
			return err
		}
		if input.Timezone != "Asia/Dhaka" {
			t.Fatalf("expected timezone to parse, got %q", input.Timezone)
		}
		if len(input.Platforms) != 2 || input.Platforms[0] != "linkedin" || input.Platforms[1] != "x" {
			t.Fatalf("expected platforms to parse, got %#v", input.Platforms)
		}
		return c.SendStatus(fiber.StatusNoContent)
	})

	req := httptest.NewRequest(
		"GET",
		"/calendar?start=2026-03-09T00:00:00Z&end=2026-03-15T23:59:59Z&timezone=Asia/Dhaka&platform=linkedin,x",
		nil,
	)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	if resp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("expected status %d, got %d", fiber.StatusNoContent, resp.StatusCode)
	}
}

func TestBindCalendarQueryRejectsInvalidRange(t *testing.T) {
	t.Parallel()

	app := fiber.New()
	app.Get("/calendar", func(c fiber.Ctx) error {
		if _, err := bindCalendarQuery(c); err == nil {
			t.Fatalf("expected invalid range to fail")
		}
		return c.SendStatus(fiber.StatusBadRequest)
	})

	req := httptest.NewRequest(
		"GET",
		"/calendar?start=bad-value&end=2026-03-15T23:59:59Z",
		nil,
	)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}

func TestBindSchedulePublicationInputParsesPlannedAt(t *testing.T) {
	t.Parallel()

	app := fiber.New()
	app.Post("/planning", func(c fiber.Ctx) error {
		input, err := bindSchedulePublicationInput(c)
		if err != nil {
			return err
		}
		if input.PlannedAt == nil || input.PlannedAt.Format("2006-01-02T15:04:05Z07:00") != "2026-03-09T09:00:00Z" {
			t.Fatalf("expected plannedAt to parse, got %#v", input.PlannedAt)
		}
		if input.Source != "manual" {
			t.Fatalf("expected source to parse, got %q", input.Source)
		}
		return c.SendStatus(fiber.StatusNoContent)
	})

	req := httptest.NewRequest(
		"POST",
		"/planning",
		bytes.NewBufferString(`{"plannedAt":"2026-03-09T09:00:00Z","source":"manual"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	if resp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("expected status %d, got %d", fiber.StatusNoContent, resp.StatusCode)
	}
}
