package ai

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"regexp"
	"slices"
	"strings"

	"github.com/google/uuid"

	"github.com/heimdall/api/internal/config"
	"github.com/heimdall/api/internal/database"
	"github.com/heimdall/api/internal/iam"
)

var hexColorPattern = regexp.MustCompile(`(?i)#(?:[0-9a-f]{6}|[0-9a-f]{3})\b`)

func (s *Service) extractBusinessContext(ctx context.Context, narrative string) (*WorkspaceBusinessContext, error) {
	provider, apiKey, model := s.defaultNativeExtractionProvider()
	if provider == "" || apiKey == "" || strings.TrimSpace(narrative) == "" {
		return heuristicBusinessExtraction(narrative), nil
	}
	systemPrompt := "Extract only decision-affecting business context for AI content generation. Reject fluff like friendly tone. Return strict JSON with keys: summary, understandingScore, missingGaps, facts. facts must be an array of objects with key, label, value, appliesTo, importance. appliesTo must use these values only: post_generation, campaign_planning, image_generation, reel_generation. importance must be low, medium, or high."
	userPrompt := fmt.Sprintf("Business description:\n%s", narrative)
	text, _, err := s.generateJSON(ctx, provider, model, apiKey, systemPrompt, userPrompt, nil)
	if err != nil {
		return nil, err
	}
	var parsed struct {
		Summary            string        `json:"summary"`
		UnderstandingScore int           `json:"understandingScore"`
		MissingGaps        []string      `json:"missingGaps"`
		Facts              []ContextFact `json:"facts"`
	}
	if err := json.Unmarshal([]byte(cleanJSONText(text)), &parsed); err != nil {
		return nil, err
	}
	return &WorkspaceBusinessContext{
		Narrative:          strings.TrimSpace(narrative),
		Summary:            strings.TrimSpace(parsed.Summary),
		UnderstandingScore: clamp(parsed.UnderstandingScore, 0, 100),
		MissingGaps:        uniqueNonEmpty(parsed.MissingGaps),
		Facts:              sanitizeFacts(parsed.Facts),
		ExtractorVersion:   extractorVersion,
		SourceHash:         hashStrings(extractorVersion, narrative),
	}, nil
}

func (s *Service) extractBrandContext(ctx context.Context, narrative string, image *providerImage) (*WorkspaceBrandContext, error) {
	provider, apiKey, model := s.defaultNativeExtractionProvider()
	if provider == "" || apiKey == "" {
		return heuristicBrandExtraction(narrative, nil), nil
	}
	systemPrompt := "Extract concrete brand identity and design tokens. Return strict JSON with keys: summary, designTokens, visualGuardrails, missingGaps. designTokens should prefer keys like primaryColor, secondaryColor, accentColor, typography, visualStyle, compositionCues, prohibitedMotifs."
	userPrompt := fmt.Sprintf("Brand description:\n%s", defaultString(strings.TrimSpace(narrative), "No narrative provided. Use the reference image if available."))
	text, _, err := s.generateJSON(ctx, provider, model, apiKey, systemPrompt, userPrompt, image)
	if err != nil {
		return nil, err
	}
	var parsed struct {
		Summary          string         `json:"summary"`
		DesignTokens     map[string]any `json:"designTokens"`
		VisualGuardrails []string       `json:"visualGuardrails"`
		MissingGaps      []string       `json:"missingGaps"`
	}
	if err := json.Unmarshal([]byte(cleanJSONText(text)), &parsed); err != nil {
		return nil, err
	}
	return &WorkspaceBrandContext{
		Narrative:        strings.TrimSpace(narrative),
		Summary:          strings.TrimSpace(parsed.Summary),
		DesignTokens:     compactMap(parsed.DesignTokens),
		VisualGuardrails: uniqueNonEmpty(parsed.VisualGuardrails),
		MissingGaps:      uniqueNonEmpty(parsed.MissingGaps),
		ProcessingStatus: processingStatusReady,
		ExtractorVersion: extractorVersion,
		SourceHash:       hashStrings(extractorVersion, narrative),
	}, nil
}

func heuristicBusinessExtraction(narrative string) *WorkspaceBusinessContext {
	trimmed := strings.TrimSpace(narrative)
	sentences := splitIntoSentences(trimmed)
	if len(sentences) == 0 && trimmed != "" {
		sentences = []string{trimmed}
	}

	var industry, offer, audience, differentiator, guardrail string
	for _, sentence := range sentences {
		lower := strings.ToLower(sentence)
		if industry == "" {
			switch {
			case strings.Contains(lower, "finance"), strings.Contains(lower, "fintech"), strings.Contains(lower, "investment"):
				industry = "Finance and investment"
			case strings.Contains(lower, "health"), strings.Contains(lower, "medical"):
				industry = "Healthcare"
			case strings.Contains(lower, "saas"), strings.Contains(lower, "software"), strings.Contains(lower, "technology"):
				industry = "Technology"
			case strings.Contains(lower, "agency"), strings.Contains(lower, "marketing"):
				industry = "Marketing and services"
			}
		}
		if offer == "" && matchesAny(lower, "we help", "we provide", "we offer", "we build", "we deliver", "we advise", "our business") {
			offer = sentence
		}
		if audience == "" && matchesAny(lower, "customers", "clients", "audience", "for businesses", "for teams", "for people", "serve") {
			audience = sentence
		}
		if differentiator == "" && matchesAny(lower, "unlike", "specialize", "focus", "different", "trusted", "licensed", "certified", "years") {
			differentiator = sentence
		}
		if guardrail == "" && matchesAny(lower, "must", "avoid", "never", "cannot", "compliance", "regulated", "legal") {
			guardrail = sentence
		}
	}

	facts := []ContextFact{}
	if industry != "" {
		facts = append(facts, ContextFact{Key: "industry", Label: "Industry", Value: industry, AppliesTo: allUseCases(), Importance: "high"})
	}
	if offer != "" {
		facts = append(facts, ContextFact{Key: "offer", Label: "Offer", Value: trimWords(offer, 24), AppliesTo: []string{useCasePostGeneration, useCaseCampaignPlanning, useCaseReelGeneration}, Importance: "high"})
	}
	if audience != "" {
		facts = append(facts, ContextFact{Key: "target_audience", Label: "Target audience", Value: trimWords(audience, 24), AppliesTo: []string{useCasePostGeneration, useCaseCampaignPlanning}, Importance: "high"})
	}
	if differentiator != "" {
		facts = append(facts, ContextFact{Key: "differentiator", Label: "Differentiator", Value: trimWords(differentiator, 22), AppliesTo: []string{useCasePostGeneration, useCaseCampaignPlanning}, Importance: "medium"})
	}
	if guardrail != "" {
		facts = append(facts, ContextFact{Key: "guardrail", Label: "Guardrail", Value: trimWords(guardrail, 22), AppliesTo: allUseCases(), Importance: "high"})
	}
	if len(facts) == 0 && trimmed != "" {
		facts = append(facts, ContextFact{Key: "business_context", Label: "Business context", Value: trimWords(trimmed, 28), AppliesTo: allUseCases(), Importance: "medium"})
	}

	missing := []string{}
	if offer == "" {
		missing = append(missing, "What you sell or deliver")
	}
	if audience == "" {
		missing = append(missing, "Who you serve")
	}
	if differentiator == "" {
		missing = append(missing, "Why customers choose you")
	}
	if guardrail == "" {
		missing = append(missing, "Any compliance or messaging constraints")
	}

	score := clamp(len(facts)*20+min(len(trimmed)/10, 20), 15, 100)
	if trimmed == "" {
		score = 0
	}
	summaryParts := []string{}
	if offer != "" {
		summaryParts = append(summaryParts, trimWords(offer, 18))
	}
	if audience != "" {
		summaryParts = append(summaryParts, trimWords(audience, 18))
	}
	if industry != "" {
		summaryParts = append(summaryParts, industry)
	}
	summary := strings.Join(summaryParts, " | ")
	if summary == "" && trimmed != "" {
		summary = trimWords(trimmed, 28)
	}
	return &WorkspaceBusinessContext{
		Narrative:          trimmed,
		Summary:            summary,
		UnderstandingScore: score,
		MissingGaps:        missing,
		Facts:              sanitizeFacts(facts),
		ExtractorVersion:   extractorVersion,
		SourceHash:         hashStrings(extractorVersion, trimmed),
	}
}

func heuristicBrandExtraction(narrative string, resourceRecord *database.Resource) *WorkspaceBrandContext {
	trimmed := strings.TrimSpace(narrative)
	tokens := map[string]any{}
	hexMatches := hexColorPattern.FindAllString(trimmed, -1)
	if len(hexMatches) > 0 {
		tokens["primaryColor"] = strings.ToUpper(hexMatches[0])
	}
	if len(hexMatches) > 1 {
		tokens["secondaryColor"] = strings.ToUpper(hexMatches[1])
	}
	colorWords := detectColorWords(trimmed)
	if len(colorWords) > 0 && tokens["primaryColor"] == nil {
		tokens["primaryColor"] = colorWords[0]
	}
	if len(colorWords) > 1 && tokens["secondaryColor"] == nil {
		tokens["secondaryColor"] = colorWords[1]
	}
	if matchesAny(strings.ToLower(trimmed), "minimal", "clean", "restrained") {
		tokens["visualStyle"] = "Minimal and restrained"
	}
	if matchesAny(strings.ToLower(trimmed), "bold", "dramatic", "assertive") {
		tokens["visualStyle"] = "Bold and assertive"
	}
	if matchesAny(strings.ToLower(trimmed), "editorial", "luxury", "premium") {
		tokens["visualStyle"] = "Editorial and premium"
	}
	if matchesAny(strings.ToLower(trimmed), "serif", "sans", "mono", "outfit") {
		tokens["typography"] = trimWords(trimmed, 20)
	}
	if resourceRecord != nil {
		tokens["referenceAsset"] = fmt.Sprintf("%s %dx%d", resourceRecord.DisplayName, valueOrZero(resourceRecord.WidthPx), valueOrZero(resourceRecord.HeightPx))
	}

	guardrails := []string{}
	for _, phrase := range splitIntoSentences(trimmed) {
		lower := strings.ToLower(phrase)
		if matchesAny(lower, "avoid", "don't", "do not", "never", "no ") {
			guardrails = append(guardrails, trimWords(phrase, 18))
		}
	}
	missing := []string{}
	if len(tokens) == 0 {
		missing = append(missing, "Concrete visual tokens such as brand colors or visual style")
	}
	if len(guardrails) == 0 {
		missing = append(missing, "Visual do-not-use rules")
	}
	summary := trimWords(trimmed, 24)
	if summary == "" && resourceRecord != nil {
		summary = fmt.Sprintf("Brand references %s for visual direction.", resourceRecord.DisplayName)
	}
	return &WorkspaceBrandContext{
		Narrative:        trimmed,
		Summary:          summary,
		DesignTokens:     compactMap(tokens),
		VisualGuardrails: uniqueNonEmpty(guardrails),
		MissingGaps:      missing,
		ProcessingStatus: processingStatusReady,
		ExtractorVersion: extractorVersion,
		SourceHash:       hashStrings(extractorVersion, trimmed, uuidString(resourceRecordID(resourceRecord))),
	}
}

func (s *Service) buildContextPayload(useCase string, business *database.WorkspaceBusinessContext, brand *database.WorkspaceBrandContext) map[string]any {
	result := map[string]any{}
	if business != nil {
		facts := sanitizeFacts(parseFacts(business.DecisionFacts))
		selectedFacts := filterFactsForUseCase(facts, useCase)
		if strings.TrimSpace(business.Summary) != "" {
			result["businessSummary"] = trimWords(business.Summary, 40)
		}
		for _, fact := range selectedFacts {
			switch fact.Key {
			case "target_audience":
				appendField(result, "audiences", fact.Value)
			case "offer":
				appendField(result, "offers", fact.Value)
			case "differentiator", "proof":
				appendField(result, "differentiators", fact.Value)
			case "guardrail", "channel_constraint":
				appendField(result, "guardrails", fact.Value)
			case "industry":
				result["industry"] = fact.Value
			default:
				appendField(result, "signals", fact.Value)
			}
		}
	}
	if brand != nil {
		tokens := compactMap(parseJSONObject(brand.DesignTokens))
		switch useCase {
		case useCasePostGeneration:
			result["brandTokens"] = pickMapKeys(tokens, "primaryColor", "secondaryColor", "accentColor", "visualStyle", "typography")
		case useCaseCampaignPlanning:
			result["brandTokens"] = pickMapKeys(tokens, "primaryColor", "visualStyle")
		case useCaseImageGeneration, useCaseReelGeneration:
			result["brandTokens"] = pickMapKeys(tokens, "primaryColor", "secondaryColor", "accentColor", "visualStyle", "typography", "compositionCues", "prohibitedMotifs", "referenceAsset")
		}
		if guardrails := uniqueNonEmpty(parseStringSlice(brand.VisualGuardrails)); len(guardrails) > 0 {
			result["visualGuardrails"] = guardrails
		}
		if strings.TrimSpace(brand.Summary) != "" && (useCase == useCaseImageGeneration || useCase == useCaseReelGeneration) {
			result["brandSummary"] = trimWords(brand.Summary, 32)
		}
	}
	switch useCase {
	case useCaseCampaignPlanning:
		delete(result, "signals")
	case useCaseImageGeneration:
		delete(result, "audiences")
		delete(result, "offers")
		delete(result, "differentiators")
	case useCaseReelGeneration:
		appendField(result, "formatConstraints", "Short-form motion asset with a strong first-frame hook.")
	}
	return trimContextPayload(result)
}

func (s *Service) buildSourceFingerprint(business *database.WorkspaceBusinessContext, brand *database.WorkspaceBrandContext) string {
	parts := []string{extractorVersion}
	if business != nil {
		parts = append(parts, business.SourceHash)
	}
	if brand != nil {
		parts = append(parts, brand.SourceHash)
	}
	return hashStrings(parts...)
}

func (s *Service) approvedModels(provider string) []string {
	switch provider {
	case providerOpenAI:
		return uniqueNonEmpty(s.cfg.OpenAIApprovedModels)
	case providerGemini:
		return uniqueNonEmpty(s.cfg.GeminiApprovedModels)
	default:
		return nil
	}
}

func (s *Service) defaultModel(provider string) string {
	switch provider {
	case providerOpenAI:
		return strings.TrimSpace(s.cfg.OpenAIDefaultModel)
	case providerGemini:
		return strings.TrimSpace(s.cfg.GeminiDefaultModel)
	default:
		return ""
	}
}

func (s *Service) defaultProvider() string {
	if s.hasNativeAPIKey(providerOpenAI) {
		return providerOpenAI
	}
	if s.hasNativeAPIKey(providerGemini) {
		return providerGemini
	}
	if len(s.cfg.OpenAIApprovedModels) > 0 {
		return providerOpenAI
	}
	if len(s.cfg.GeminiApprovedModels) > 0 {
		return providerGemini
	}
	return ""
}

func defaultMode(cfg config.AIConfig) string {
	if len(nativeAPIKeysForConfig(cfg, providerOpenAI)) > 0 || len(nativeAPIKeysForConfig(cfg, providerGemini)) > 0 {
		return modeNative
	}
	return modeBYOK
}

func (s *Service) defaultCapabilityDefaults() map[string]AIModelSelection {
	provider := s.defaultProvider()
	model := s.defaultModel(provider)
	result := map[string]AIModelSelection{}
	for _, useCase := range []string{useCasePostGeneration, useCaseCampaignPlanning, useCaseImageGeneration, useCaseReelGeneration} {
		result[useCase] = AIModelSelection{Provider: provider, Model: model}
	}
	return result
}

func (s *Service) hasNativeAPIKey(provider string) bool {
	return len(s.nativeAPIKeys(provider)) > 0
}

func (s *Service) nativeAPIKey(provider string) string {
	keys := s.nativeAPIKeys(provider)
	if len(keys) == 0 {
		return ""
	}
	return keys[0]
}

func (s *Service) nativeAPIKeys(provider string) []string {
	return nativeAPIKeysForConfig(s.cfg, provider)
}

func nativeAPIKeysForConfig(cfg config.AIConfig, provider string) []string {
	var values []string
	var singular string
	switch provider {
	case providerOpenAI:
		values = cfg.OpenAIAPIKeys
		singular = cfg.OpenAIAPIKey
	case providerGemini:
		values = cfg.GeminiAPIKeys
		singular = cfg.GeminiAPIKey
	default:
		return []string{}
	}
	if result := uniqueNonEmpty(values); len(result) > 0 {
		return result
	}
	return uniqueNonEmpty([]string{singular})
}

func (s *Service) defaultNativeExtractionProvider() (string, string, string) {
	if apiKey := s.nativeAPIKey(providerOpenAI); apiKey != "" {
		return providerOpenAI, apiKey, s.defaultModel(providerOpenAI)
	}
	if apiKey := s.nativeAPIKey(providerGemini); apiKey != "" {
		return providerGemini, apiKey, s.defaultModel(providerGemini)
	}
	return "", "", ""
}

func (s *Service) validateCapabilityDefaults(defaults map[string]AIModelSelection) error {
	for useCase, selection := range defaults {
		if !slices.Contains([]string{useCasePostGeneration, useCaseCampaignPlanning, useCaseImageGeneration, useCaseReelGeneration}, useCase) {
			return fmt.Errorf("%w: unsupported ai capability %s", iam.ErrValidation, useCase)
		}
		if selection.Provider == "" || selection.Model == "" {
			return fmt.Errorf("%w: provider and model are required for %s", iam.ErrValidation, useCase)
		}
		if !slices.Contains(s.approvedModels(selection.Provider), selection.Model) {
			return fmt.Errorf("%w: model %s is not approved for %s", iam.ErrValidation, selection.Model, selection.Provider)
		}
	}
	return nil
}

func (s *Service) normalizeCapabilityDefaults(input map[string]AIModelSelection) map[string]AIModelSelection {
	result := s.defaultCapabilityDefaults()
	for key, value := range input {
		result[key] = AIModelSelection{Provider: strings.TrimSpace(value.Provider), Model: strings.TrimSpace(value.Model)}
	}
	return result
}

func (s *Service) validateAllowedModels(provider string, allowedModels []string) error {
	approved := s.approvedModels(provider)
	for _, model := range allowedModels {
		if !slices.Contains(approved, model) {
			return fmt.Errorf("%w: model %s is not approved for %s", iam.ErrValidation, model, provider)
		}
	}
	return nil
}

func parseCapabilityDefaults(raw string) map[string]AIModelSelection {
	var parsed map[string]AIModelSelection
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil || parsed == nil {
		return map[string]AIModelSelection{}
	}
	result := map[string]AIModelSelection{}
	for key, value := range parsed {
		if value.Provider != "" || value.Model != "" {
			result[key] = AIModelSelection{Provider: strings.TrimSpace(value.Provider), Model: strings.TrimSpace(value.Model)}
		}
	}
	return result
}

func parseFacts(raw string) []ContextFact {
	var parsed []ContextFact
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return []ContextFact{}
	}
	return sanitizeFacts(parsed)
}

func sanitizeFacts(facts []ContextFact) []ContextFact {
	result := make([]ContextFact, 0, len(facts))
	seen := map[string]struct{}{}
	for _, fact := range facts {
		fact.Key = strings.TrimSpace(strings.ToLower(strings.ReplaceAll(fact.Key, " ", "_")))
		fact.Label = strings.TrimSpace(fact.Label)
		fact.Value = trimWords(strings.TrimSpace(fact.Value), 28)
		fact.Importance = normalizeImportance(fact.Importance)
		fact.AppliesTo = normalizeUseCases(fact.AppliesTo)
		if fact.Key == "" || fact.Label == "" || fact.Value == "" {
			continue
		}
		cacheKey := fact.Key + "|" + strings.ToLower(fact.Value)
		if _, ok := seen[cacheKey]; ok {
			continue
		}
		seen[cacheKey] = struct{}{}
		result = append(result, fact)
	}
	return result
}

func filterFactsForUseCase(facts []ContextFact, useCase string) []ContextFact {
	result := make([]ContextFact, 0, len(facts))
	for _, fact := range facts {
		if slices.Contains(fact.AppliesTo, useCase) {
			result = append(result, fact)
		}
	}
	slices.SortStableFunc(result, func(left, right ContextFact) int {
		return importanceRank(right.Importance) - importanceRank(left.Importance)
	})
	if len(result) > 6 {
		return result[:6]
	}
	return result
}

func normalizeImportance(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "high":
		return "high"
	case "low":
		return "low"
	default:
		return "medium"
	}
}

func importanceRank(value string) int {
	switch value {
	case "high":
		return 3
	case "medium":
		return 2
	default:
		return 1
	}
}

func normalizeUseCases(values []string) []string {
	result := []string{}
	allowed := allUseCases()
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if slices.Contains(allowed, trimmed) && !slices.Contains(result, trimmed) {
			result = append(result, trimmed)
		}
	}
	if len(result) == 0 {
		return allUseCases()
	}
	return result
}

func allUseCases() []string {
	return []string{useCasePostGeneration, useCaseCampaignPlanning, useCaseImageGeneration, useCaseReelGeneration}
}

func normalizeGeneratedUseCase(value string) string {
	switch strings.TrimSpace(value) {
	case useCasePostGeneration,
		useCaseCampaignPlanning,
		useCaseVariationGeneration,
		useCaseImageGeneration,
		useCaseReelGeneration,
		useCasePDFGeneration:
		return strings.TrimSpace(value)
	default:
		return ""
	}
}

func normalizeConfiguredUseCase(useCase string) string {
	switch useCase {
	case useCaseVariationGeneration, useCasePDFGeneration:
		return useCasePostGeneration
	default:
		return useCase
	}
}

func normalizeContextCacheUseCase(useCase string) string {
	switch useCase {
	case useCaseVariationGeneration, useCasePDFGeneration:
		return useCasePostGeneration
	default:
		return useCase
	}
}

func marshalMustJSON(value any) string {
	encoded, _ := json.Marshal(value)
	return string(encoded)
}

func marshalPretty(value any) string {
	encoded, _ := json.MarshalIndent(value, "", "  ")
	return string(encoded)
}

func parseStringSlice(raw string) []string {
	var values []string
	if err := json.Unmarshal([]byte(raw), &values); err != nil {
		return []string{}
	}
	return uniqueNonEmpty(values)
}

func parseJSONObject(raw string) map[string]any {
	var values map[string]any
	if err := json.Unmarshal([]byte(raw), &values); err != nil {
		return map[string]any{}
	}
	return values
}

func compactMap(values map[string]any) map[string]any {
	result := map[string]any{}
	for key, value := range values {
		switch typed := value.(type) {
		case string:
			if trimmed := strings.TrimSpace(typed); trimmed != "" {
				result[key] = trimWords(trimmed, 18)
			}
		case []string:
			if cleaned := uniqueNonEmpty(typed); len(cleaned) > 0 {
				result[key] = cleaned
			}
		case []any:
			if cleaned := toStringSlice(typed); len(cleaned) > 0 {
				result[key] = cleaned
			}
		default:
			if value != nil {
				result[key] = value
			}
		}
	}
	return result
}

func pickMapKeys(values map[string]any, keys ...string) map[string]any {
	result := map[string]any{}
	for _, key := range keys {
		if value, ok := values[key]; ok {
			result[key] = value
		}
	}
	return result
}

func trimContextPayload(payload map[string]any) map[string]any {
	result := map[string]any{}
	for key, value := range payload {
		switch typed := value.(type) {
		case string:
			if trimmed := strings.TrimSpace(typed); trimmed != "" {
				result[key] = trimWords(trimmed, 32)
			}
		case []string:
			if cleaned := uniqueNonEmpty(typed); len(cleaned) > 0 {
				if len(cleaned) > 4 {
					cleaned = cleaned[:4]
				}
				result[key] = cleaned
			}
		case map[string]any:
			if len(typed) > 0 {
				result[key] = compactMap(typed)
			}
		default:
			if value != nil {
				result[key] = value
			}
		}
	}
	return result
}

func appendField(payload map[string]any, key, value string) {
	if strings.TrimSpace(value) == "" {
		return
	}
	current, _ := payload[key].([]string)
	value = trimWords(value, 22)
	if !slices.Contains(current, value) {
		payload[key] = append(current, value)
	}
}

func splitIntoSentences(value string) []string {
	fields := strings.FieldsFunc(value, func(r rune) bool {
		return r == '\n' || r == '.' || r == '!' || r == '?'
	})
	result := make([]string, 0, len(fields))
	for _, field := range fields {
		if trimmed := strings.TrimSpace(field); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func detectColorWords(value string) []string {
	colorWords := []string{"black", "white", "gray", "grey", "blue", "navy", "red", "green", "gold", "amber", "orange", "teal", "beige", "brown"}
	lower := strings.ToLower(value)
	result := []string{}
	for _, color := range colorWords {
		if strings.Contains(lower, color) {
			result = append(result, color)
		}
	}
	return uniqueNonEmpty(result)
}

func matchesAny(value string, needles ...string) bool {
	for _, needle := range needles {
		if strings.Contains(value, needle) {
			return true
		}
	}
	return false
}

func trimWords(value string, maxWords int) string {
	parts := strings.Fields(strings.TrimSpace(value))
	if len(parts) <= maxWords {
		return strings.Join(parts, " ")
	}
	return strings.Join(parts[:maxWords], " ")
}

func uniqueNonEmpty(values []string) []string {
	result := []string{}
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" || slices.Contains(result, trimmed) {
			continue
		}
		result = append(result, trimmed)
	}
	return result
}

func toStringSlice(value any) []string {
	switch typed := value.(type) {
	case []string:
		return uniqueNonEmpty(typed)
	case []any:
		result := []string{}
		for _, item := range typed {
			if text, ok := item.(string); ok {
				result = append(result, text)
			}
		}
		return uniqueNonEmpty(result)
	default:
		return []string{}
	}
}

func cleanJSONText(value string) string {
	trimmed := strings.TrimSpace(value)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	return strings.TrimSpace(trimmed)
}

func compactString(value any) string {
	text, _ := value.(string)
	return strings.TrimSpace(text)
}

func buildProviderError(statusCode int, raw []byte) error {
	message := strings.TrimSpace(string(raw))
	if message == "" {
		message = fmt.Sprintf("provider request failed with status %d", statusCode)
	}
	lower := strings.ToLower(message)
	return &providerError{
		StatusCode: statusCode,
		Message:    message,
		Retryable:  statusCode == 401 || statusCode == 403 || statusCode == 429 || statusCode >= 500 || strings.Contains(lower, "rate") || strings.Contains(lower, "quota") || strings.Contains(lower, "credit"),
	}
}

func secretHint(value string) string {
	trimmed := strings.TrimSpace(value)
	if len(trimmed) <= 6 {
		return trimmed
	}
	return fmt.Sprintf("%s...%s", trimmed[:4], trimmed[len(trimmed)-2:])
}

func hashStrings(values ...string) string {
	hasher := sha256.New()
	for _, value := range values {
		_, _ = hasher.Write([]byte(value))
		_, _ = hasher.Write([]byte{'\n'})
	}
	return fmt.Sprintf("%x", hasher.Sum(nil))
}

func clamp(value, minValue, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func min(left, right int) int {
	if left < right {
		return left
	}
	return right
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}

func uuidString(value *uuid.UUID) string {
	if value == nil {
		return ""
	}
	return value.String()
}

func resourceRecordID(record *database.Resource) *uuid.UUID {
	if record == nil {
		return nil
	}
	return &record.ID
}

func valueOrZero(value *int) int {
	if value == nil {
		return 0
	}
	return *value
}
