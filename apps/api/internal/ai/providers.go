package ai

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"github.com/heimdall/api/internal/database"
	"github.com/heimdall/api/internal/iam"
)

const maxReferenceImageBytes = 4 * 1024 * 1024

func (s *Service) generateJSON(ctx context.Context, provider, model, apiKey, systemPrompt, userPrompt string, image *providerImage) (string, aiUsage, error) {
	return s.generateJSONWithBaseURL(ctx, provider, model, apiKey, s.providerBaseURL(provider), systemPrompt, userPrompt, image)
}

func (s *Service) generateJSONWithBaseURL(ctx context.Context, provider, model, apiKey, baseURL, systemPrompt, userPrompt string, image *providerImage) (string, aiUsage, error) {
	switch provider {
	case providerOpenAI:
		return s.generateOpenAI(ctx, model, apiKey, baseURL, systemPrompt, userPrompt, image, true, false)
	case providerCopilot:
		return s.generateCopilot(ctx, model, apiKey, baseURL, systemPrompt, userPrompt, image, true)
	case providerGemini:
		return s.generateGemini(ctx, model, apiKey, baseURL, systemPrompt, userPrompt, image, true)
	default:
		return "", aiUsage{}, fmt.Errorf("%w: unsupported ai provider", iam.ErrValidation)
	}
}

func (s *Service) generateOpenAI(ctx context.Context, model, apiKey, baseURL, systemPrompt, userPrompt string, image *providerImage, jsonMode, githubTokenHeader bool) (string, aiUsage, error) {
	type openAIMessage struct {
		Role    string `json:"role"`
		Content any    `json:"content"`
	}
	type openAIContentPart struct {
		Type     string `json:"type"`
		Text     string `json:"text,omitempty"`
		ImageURL any    `json:"image_url,omitempty"`
	}

	userContent := []openAIContentPart{{Type: "text", Text: userPrompt}}
	if image != nil && len(image.Data) > 0 {
		userContent = append(userContent, openAIContentPart{
			Type: "image_url",
			ImageURL: map[string]any{
				"url": fmt.Sprintf("data:%s;base64,%s", image.MimeType, base64.StdEncoding.EncodeToString(image.Data)),
			},
		})
	}

	body := map[string]any{
		"model": model,
		"messages": []openAIMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userContent},
		},
		"temperature": 0.35,
	}
	if jsonMode {
		body["response_format"] = map[string]any{"type": "json_object"}
	}
	requestBody, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(baseURL, "/")+"/chat/completions", bytes.NewReader(requestBody))
	if err != nil {
		return "", aiUsage{}, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	if githubTokenHeader {
		req.Header.Set("X-GitHub-Token", apiKey)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", aiUsage{}, err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= http.StatusBadRequest {
		return "", aiUsage{}, buildProviderError(resp.StatusCode, raw)
	}

	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", aiUsage{}, err
	}
	if len(parsed.Choices) == 0 {
		return "", aiUsage{}, fmt.Errorf("%w: openai returned no choices", iam.ErrValidation)
	}
	return parsed.Choices[0].Message.Content, aiUsage{
		PromptTokens:     parsed.Usage.PromptTokens,
		CompletionTokens: parsed.Usage.CompletionTokens,
		TotalTokens:      parsed.Usage.TotalTokens,
	}, nil
}

func (s *Service) generateCopilot(ctx context.Context, model, apiKey, baseURL, systemPrompt, userPrompt string, image *providerImage, jsonMode bool) (string, aiUsage, error) {
	text, usage, err := s.generateOpenAI(ctx, model, apiKey, baseURL, systemPrompt, userPrompt, image, jsonMode, true)
	return text, usage, err
}

func (s *Service) generateGemini(ctx context.Context, model, apiKey, baseURL, systemPrompt, userPrompt string, image *providerImage, jsonMode bool) (string, aiUsage, error) {
	parts := []map[string]any{{"text": systemPrompt + "\n\n" + userPrompt}}
	if image != nil && len(image.Data) > 0 {
		parts = append(parts, map[string]any{
			"inlineData": map[string]any{
				"mimeType": image.MimeType,
				"data":     base64.StdEncoding.EncodeToString(image.Data),
			},
		})
	}
	body := map[string]any{
		"contents": []map[string]any{
			{
				"role":  "user",
				"parts": parts,
			},
		},
		"generationConfig": map[string]any{
			"temperature": 0.35,
		},
	}
	if jsonMode {
		body["generationConfig"].(map[string]any)["responseMimeType"] = "application/json"
	}
	requestBody, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/models/%s:generateContent?key=%s", strings.TrimRight(baseURL, "/"), model, apiKey), bytes.NewReader(requestBody))
	if err != nil {
		return "", aiUsage{}, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", aiUsage{}, err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= http.StatusBadRequest {
		return "", aiUsage{}, buildProviderError(resp.StatusCode, raw)
	}

	var parsed struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
		UsageMetadata struct {
			PromptTokenCount     int `json:"promptTokenCount"`
			CandidatesTokenCount int `json:"candidatesTokenCount"`
			TotalTokenCount      int `json:"totalTokenCount"`
		} `json:"usageMetadata"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", aiUsage{}, err
	}
	if len(parsed.Candidates) == 0 {
		return "", aiUsage{}, fmt.Errorf("%w: gemini returned no candidates", iam.ErrValidation)
	}
	var builder strings.Builder
	for _, part := range parsed.Candidates[0].Content.Parts {
		builder.WriteString(part.Text)
	}
	return builder.String(), aiUsage{
		PromptTokens:     parsed.UsageMetadata.PromptTokenCount,
		CompletionTokens: parsed.UsageMetadata.CandidatesTokenCount,
		TotalTokens:      parsed.UsageMetadata.TotalTokenCount,
	}, nil
}

func (s *Service) loadReferenceImage(ctx context.Context, workspaceID uuid.UUID, resourceID *uuid.UUID) (*providerImage, *database.Resource, error) {
	if resourceID == nil {
		return nil, nil, nil
	}
	record := new(database.Resource)
	if err := s.db.NewSelect().
		Model(record).
		Where("id = ?", *resourceID).
		Where("workspace_id = ?", workspaceID).
		Where("media_kind = ?", "image").
		Limit(1).
		Scan(ctx); err != nil {
		return nil, nil, err
	}
	reader, err := s.storage.Open(ctx, record.StorageKey)
	if err != nil {
		return nil, record, err
	}
	defer reader.Close()
	data, err := io.ReadAll(io.LimitReader(reader, maxReferenceImageBytes+1))
	if err != nil {
		return nil, record, err
	}
	if len(data) > maxReferenceImageBytes {
		return nil, record, nil
	}
	return &providerImage{MimeType: record.MIMEType, Data: data}, record, nil
}
