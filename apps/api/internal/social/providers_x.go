package social

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"strings"
	"time"

	"github.com/heimdall/api/internal/config"
	"github.com/heimdall/api/internal/database"
)

type xAdapter struct {
	cfg config.SocialConfig
}

func newXAdapter(cfg config.SocialConfig) providerAdapter {
	return &xAdapter{cfg: cfg}
}

func (a *xAdapter) Provider() string { return "x" }
func (a *xAdapter) Label() string    { return "X" }
func (a *xAdapter) DefaultScopes() []string {
	return []string{"tweet.read", "tweet.write", "users.read", "media.write", "offline.access"}
}
func (a *xAdapter) SupportsBYOK() bool { return true }

func (a *xAdapter) BuildAuthorizationURL(credential providerCredential, redirectURI string, state database.SocialOAuthState) (string, error) {
	challenge := ""
	if state.CodeVerifier != nil {
		challenge = pkceChallenge(*state.CodeVerifier)
	}
	query := url.Values{
		"response_type":         []string{"code"},
		"client_id":             []string{credential.ClientID},
		"redirect_uri":          []string{redirectURI},
		"scope":                 []string{strings.Join(a.DefaultScopes(), " ")},
		"state":                 []string{state.StateToken},
		"code_challenge":        []string{challenge},
		"code_challenge_method": []string{"S256"},
	}
	return "https://x.com/i/oauth2/authorize?" + query.Encode(), nil
}

func (a *xAdapter) ExchangeCode(ctx context.Context, credential providerCredential, redirectURI string, state database.SocialOAuthState, code string) (*exchangeResult, error) {
	values := url.Values{
		"grant_type":    []string{"authorization_code"},
		"code":          []string{code},
		"redirect_uri":  []string{redirectURI},
		"client_id":     []string{credential.ClientID},
	}
	if state.CodeVerifier != nil {
		values.Set("code_verifier", *state.CodeVerifier)
	}
	headers := map[string]string{
		"Authorization": "Basic " + base64.StdEncoding.EncodeToString([]byte(credential.ClientID+":"+credential.ClientSecret)),
	}
	resp, err := postForm(ctx, "https://api.x.com/2/oauth2/token", values, headers)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("x token exchange failed (%d): %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var tokenResp struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		Scope        string `json:"scope"`
		ExpiresIn    int64  `json:"expires_in"`
		TokenType    string `json:"token_type"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, err
	}
	var me struct {
		Data struct {
			ID       string `json:"id"`
			Name     string `json:"name"`
			Username string `json:"username"`
		} `json:"data"`
	}
	if err := getJSON(ctx, "https://api.x.com/2/users/me?user.fields=profile_image_url,public_metrics,verified", map[string]string{
		"Authorization": "Bearer " + tokenResp.AccessToken,
	}, &me); err != nil {
		return nil, err
	}
	var expiresAt *time.Time
	if tokenResp.ExpiresIn > 0 {
		value := time.Now().UTC().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
		expiresAt = &value
	}
	target := discoveredTarget{
		ExternalAccountID:     me.Data.ID,
		DisplayName:           me.Data.Name,
		Username:              me.Data.Username,
		TargetType:            "x_account",
		AccountClassification: "business",
		Scopes:                strings.Fields(tokenResp.Scope),
		Status:                targetStatusHealthy,
		Capabilities: map[string]any{
			"allowedSurfaces": []string{"text_post", "thread_post", "image_post", "video_post"},
		},
		Metadata: map[string]any{"username": me.Data.Username},
	}
	return &exchangeResult{
		AuthSubjectID:        me.Data.ID,
		AuthSubjectName:      me.Data.Name,
		AccessToken:          tokenResp.AccessToken,
		RefreshToken:         tokenResp.RefreshToken,
		TokenType:            tokenResp.TokenType,
		AccessTokenExpiresAt: expiresAt,
		Scopes:               strings.Fields(tokenResp.Scope),
		Metadata:             map[string]any{"username": me.Data.Username},
		Targets:              []discoveredTarget{target},
	}, nil
}

func (a *xAdapter) RefreshConnection(ctx context.Context, session providerSession) (*exchangeResult, error) {
	var me struct {
		Data struct {
			ID       string `json:"id"`
			Name     string `json:"name"`
			Username string `json:"username"`
		} `json:"data"`
	}
	if err := getJSON(ctx, "https://api.x.com/2/users/me", map[string]string{"Authorization": "Bearer " + session.AccessToken}, &me); err != nil {
		return nil, err
	}
	return &exchangeResult{
		AuthSubjectID:   me.Data.ID,
		AuthSubjectName: me.Data.Name,
		AccessToken:     session.AccessToken,
		RefreshToken:    session.RefreshToken,
		TokenType:       "Bearer",
		Scopes:          session.Scopes,
		Metadata:        parseJSONMap(session.Connection.Metadata),
	}, nil
}

func (a *xAdapter) ValidateTargetCapabilities(ctx context.Context, session providerSession, target database.SocialTarget) (*validateResult, error) {
	var me struct {
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := getJSON(ctx, "https://api.x.com/2/users/me", map[string]string{"Authorization": "Bearer " + session.AccessToken}, &me); err != nil {
		return &validateResult{
			Scopes:       parseJSONStringSlice(target.ScopeSnapshot),
			Capabilities: parseJSONMap(target.CapabilitySnapshot),
			Status:       targetStatusReauth,
			Error:        err.Error(),
		}, nil
	}
	return &validateResult{
		Scopes:       parseJSONStringSlice(target.ScopeSnapshot),
		Capabilities: parseJSONMap(target.CapabilitySnapshot),
		Status:       targetStatusHealthy,
	}, nil
}

func (a *xAdapter) PublishPost(ctx context.Context, session providerSession, target database.SocialTarget, content publishContent, assets []assetBlob) (*publishResult, error) {
	mediaIDs := make([]string, 0, len(assets))
	for _, asset := range assets {
		mediaID, err := a.uploadMedia(ctx, session.AccessToken, asset, content.Caption)
		if err != nil {
			return nil, err
		}
		mediaIDs = append(mediaIDs, mediaID)
	}
	payload := map[string]any{"text": truncateXText(content.Caption)}
	if len(content.ThreadItems) > 0 {
		payload["text"] = truncateXText(strings.Join(content.ThreadItems, "\n\n"))
	}
	if len(mediaIDs) > 0 {
		payload["media"] = map[string]any{"media_ids": mediaIDs}
	}
	var resp struct {
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := postJSON(ctx, "https://api.x.com/2/posts", payload, map[string]string{
		"Authorization": "Bearer " + session.AccessToken,
	}, &resp); err != nil {
		return nil, err
	}
	return &publishResult{
		ExternalPostID:    resp.Data.ID,
		ExternalAccountID: target.ExternalAccountID,
		PublishedAt:       time.Now().UTC(),
		Metadata:          map[string]any{"mediaIds": mediaIDs},
	}, nil
}

func (a *xAdapter) GetPostMetrics(ctx context.Context, session providerSession, target database.SocialTarget, publication database.PostVariantPublication) (*metricResult, error) {
	if publication.ExternalPostID == nil {
		return &metricResult{Metrics: map[string]float64{}, Metadata: map[string]any{}}, nil
	}
	var resp struct {
		Data []struct {
			ID            string `json:"id"`
			PublicMetrics struct {
				LikeCount       float64 `json:"like_count"`
				ReplyCount      float64 `json:"reply_count"`
				RetweetCount    float64 `json:"retweet_count"`
				QuoteCount      float64 `json:"quote_count"`
				ImpressionCount float64 `json:"impression_count"`
			} `json:"public_metrics"`
		} `json:"data"`
	}
	if err := getJSON(ctx,
		fmt.Sprintf("https://api.x.com/2/posts?ids=%s&post.fields=public_metrics", *publication.ExternalPostID),
		map[string]string{"Authorization": "Bearer " + session.AccessToken},
		&resp,
	); err != nil {
		return nil, err
	}
	if len(resp.Data) == 0 {
		return &metricResult{Metrics: map[string]float64{}, Metadata: map[string]any{}}, nil
	}
	post := resp.Data[0]
	return &metricResult{
		Metrics: map[string]float64{
			"likes":       post.PublicMetrics.LikeCount,
			"comments":    post.PublicMetrics.ReplyCount,
			"reposts":     post.PublicMetrics.RetweetCount,
			"shares":      post.PublicMetrics.QuoteCount,
			"impressions": post.PublicMetrics.ImpressionCount,
		},
		Metadata: map[string]any{"provider": "x"},
	}, nil
}

func (a *xAdapter) uploadMedia(ctx context.Context, accessToken string, asset assetBlob, caption string) (string, error) {
	reader, err := asset.Open(ctx)
	if err != nil {
		return "", err
	}
	defer reader.Close()
	var resp struct {
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := postMultipart(ctx, "https://api.x.com/2/media/upload", nil, "media", asset.OriginalName, reader, map[string]string{
		"Authorization": "Bearer " + accessToken,
	}, &resp); err != nil {
		return "", err
	}
	if strings.TrimSpace(caption) != "" && asset.MediaKind == "image" {
		_ = postJSON(ctx, "https://api.x.com/2/media/metadata/create", map[string]any{
			"media_id": resp.Data.ID,
			"alt_text": map[string]any{"text": truncateXText(caption)},
		}, map[string]string{"Authorization": "Bearer " + accessToken}, nil)
	}
	return resp.Data.ID, nil
}

func truncateXText(value string) string {
	value = strings.TrimSpace(value)
	if len(value) <= 280 {
		return value
	}
	return value[:277] + "..."
}
