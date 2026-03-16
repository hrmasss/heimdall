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

func TestBindPostInputParsesCampaignID(t *testing.T) {
	t.Parallel()

	campaignID := "55f9f657-5e7c-4d3a-8e4f-4a85d228eafb"
	app := fiber.New()
	app.Post("/posts", func(c fiber.Ctx) error {
		input, err := bindPostInput(c)
		if err != nil {
			return err
		}
		if input.CampaignID == nil || input.CampaignID.String() != campaignID {
			t.Fatalf("expected campaign id to parse, got %#v", input.CampaignID)
		}
		return c.SendStatus(fiber.StatusNoContent)
	})

	req := httptest.NewRequest(
		"POST",
		"/posts",
		bytes.NewBufferString(`{"title":"Launch","campaignId":"`+campaignID+`"}`),
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

func TestBindCampaignInputParsesDatesAndPostIDs(t *testing.T) {
	t.Parallel()

	app := fiber.New()
	app.Post("/campaigns", func(c fiber.Ctx) error {
		input, err := bindCampaignInput(c)
		if err != nil {
			return err
		}
		if input.StartDate.Format("2006-01-02") != "2026-03-16" {
			t.Fatalf("expected start date to parse, got %s", input.StartDate)
		}
		if input.EndDate == nil || input.EndDate.Format("2006-01-02") != "2026-03-20" {
			t.Fatalf("expected end date to parse, got %#v", input.EndDate)
		}
		if len(input.PostIDs) != 1 {
			t.Fatalf("expected one post id, got %#v", input.PostIDs)
		}
		if input.DefaultTimezone != "Asia/Dhaka" {
			t.Fatalf("expected timezone to parse, got %q", input.DefaultTimezone)
		}
		if len(input.DeliveryTargets) != 1 {
			t.Fatalf("expected one delivery target, got %#v", input.DeliveryTargets)
		}
		if len(input.ScheduleRules) != 1 || input.ScheduleRules[0].SocialTargetID != input.DeliveryTargets[0].SocialTargetID {
			t.Fatalf("expected schedule rule to parse, got %#v", input.ScheduleRules)
		}
		if input.ScheduleRules[0].StartDate == nil || input.ScheduleRules[0].EndDate == nil {
			t.Fatalf("expected optional rule dates to parse, got %#v", input.ScheduleRules[0])
		}
		return c.SendStatus(fiber.StatusNoContent)
	})

	req := httptest.NewRequest(
		"POST",
		"/campaigns",
		bytes.NewBufferString(`{"name":"Launch","startDate":"2026-03-16","endDate":"2026-03-20","defaultTimezone":"Asia/Dhaka","postIds":["55f9f657-5e7c-4d3a-8e4f-4a85d228eafb"],"deliveryTargets":[{"socialTargetId":"11111111-1111-1111-1111-111111111111"}],"scheduleRules":[{"socialTargetId":"11111111-1111-1111-1111-111111111111","enabled":true,"cadenceType":"weekly","interval":1,"weekdays":["mon","wed"],"timesLocal":["09:00"],"startDate":"2026-03-16","endDate":"2026-03-20"}]}`),
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

func TestBindCampaignInputRejectsInvalidDates(t *testing.T) {
	t.Parallel()

	app := fiber.New()
	app.Post("/campaigns", func(c fiber.Ctx) error {
		if _, err := bindCampaignInput(c); err == nil {
			t.Fatalf("expected invalid date to fail")
		}
		return c.SendStatus(fiber.StatusBadRequest)
	})

	req := httptest.NewRequest(
		"POST",
		"/campaigns",
		bytes.NewBufferString(`{"name":"Launch","startDate":"bad-date","endDate":"2026-03-20"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}

func TestBindCampaignInputAllowsBlankEndDate(t *testing.T) {
	t.Parallel()

	app := fiber.New()
	app.Post("/campaigns", func(c fiber.Ctx) error {
		input, err := bindCampaignInput(c)
		if err != nil {
			return err
		}
		if input.EndDate != nil {
			t.Fatalf("expected blank end date to stay nil, got %#v", input.EndDate)
		}
		return c.SendStatus(fiber.StatusNoContent)
	})

	req := httptest.NewRequest(
		"POST",
		"/campaigns",
		bytes.NewBufferString(`{"name":"Evergreen","startDate":"2026-03-16","endDate":""}`),
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
