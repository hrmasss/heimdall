package social

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/heimdall/api/internal/config"
	"github.com/heimdall/api/internal/database"
)

type metaAdapter struct {
	cfg config.SocialConfig
}

var metaInstagramPublishRetryDelays = []time.Duration{
	2 * time.Second,
	4 * time.Second,
	6 * time.Second,
	8 * time.Second,
}

func newMetaAdapter(cfg config.SocialConfig) providerAdapter {
	return &metaAdapter{cfg: cfg}
}

func (a *metaAdapter) Provider() string { return "meta" }
func (a *metaAdapter) Label() string    { return "Meta" }
func (a *metaAdapter) DefaultScopes() []string {
	return []string{
		"pages_manage_posts",
		"pages_read_engagement",
		"pages_manage_engagement",
		"publish_video",
		"instagram_basic",
		"instagram_content_publish",
		"business_management",
	}
}
func (a *metaAdapter) SupportsBYOK() bool { return true }

func (a *metaAdapter) BuildAuthorizationURL(credential providerCredential, redirectURI string, state database.SocialOAuthState) (string, error) {
	query := url.Values{
		"client_id":     []string{credential.ClientID},
		"redirect_uri":  []string{redirectURI},
		"response_type": []string{"code"},
		"scope":         []string{strings.Join(a.DefaultScopes(), ",")},
		"state":         []string{state.StateToken},
	}
	return fmt.Sprintf("https://www.facebook.com/%s/dialog/oauth?%s", a.cfg.MetaAPIVersion, query.Encode()), nil
}

func (a *metaAdapter) ExchangeCode(ctx context.Context, credential providerCredential, redirectURI string, state database.SocialOAuthState, code string) (*exchangeResult, error) {
	tokenEndpoint := fmt.Sprintf("https://graph.facebook.com/%s/oauth/access_token", a.cfg.MetaAPIVersion)
	tokenValues := url.Values{
		"client_id":     []string{credential.ClientID},
		"client_secret": []string{credential.ClientSecret},
		"redirect_uri":  []string{redirectURI},
		"code":          []string{code},
	}
	var tokenResp struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
		ExpiresIn   int64  `json:"expires_in"`
	}
	resp, err := postForm(ctx, tokenEndpoint, tokenValues, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("meta token exchange failed (%d): %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, err
	}
	var me struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	if err := getJSON(ctx,
		fmt.Sprintf("https://graph.facebook.com/%s/me?fields=id,name&access_token=%s", a.cfg.MetaAPIVersion, url.QueryEscape(tokenResp.AccessToken)),
		nil,
		&me,
	); err != nil {
		return nil, err
	}
	var pages struct {
		Data []struct {
			ID                       string   `json:"id"`
			Name                     string   `json:"name"`
			AccessToken              string   `json:"access_token"`
			Tasks                    []string `json:"tasks"`
			InstagramBusinessAccount struct {
				ID       string `json:"id"`
				Username string `json:"username"`
				Name     string `json:"name"`
			} `json:"instagram_business_account"`
		} `json:"data"`
	}
	if err := getJSON(ctx,
		fmt.Sprintf("https://graph.facebook.com/%s/me/accounts?fields=id,name,access_token,tasks,instagram_business_account{id,username,name}&access_token=%s", a.cfg.MetaAPIVersion, url.QueryEscape(tokenResp.AccessToken)),
		nil,
		&pages,
	); err != nil {
		return nil, err
	}
	targets := make([]discoveredTarget, 0, len(pages.Data)*2)
	for _, page := range pages.Data {
		pageMetadata := map[string]any{
			"pageAccessToken": page.AccessToken,
			"tasks":           page.Tasks,
		}
		targets = append(targets, discoveredTarget{
			ExternalAccountID:     page.ID,
			DisplayName:           page.Name,
			TargetType:            "facebook_page",
			AccountClassification: "business",
			Scopes:                page.Tasks,
			Status:                targetStatusHealthy,
			Capabilities: map[string]any{
				"allowedSurfaces": []string{"feed_post", "feed_photo", "video"},
				"tasks":           page.Tasks,
			},
			Metadata: pageMetadata,
		})
		if page.InstagramBusinessAccount.ID != "" {
			targets = append(targets, discoveredTarget{
				ExternalAccountID:     page.InstagramBusinessAccount.ID,
				ExternalParentID:      page.ID,
				DisplayName:           defaultString(page.InstagramBusinessAccount.Name, page.Name),
				Username:              page.InstagramBusinessAccount.Username,
				TargetType:            "instagram_professional",
				AccountClassification: "business",
				Scopes:                []string{"instagram_basic", "instagram_content_publish"},
				Status:                targetStatusHealthy,
				Capabilities: map[string]any{
					"allowedSurfaces": []string{"feed_photo", "carousel", "reel"},
					"tasks":           page.Tasks,
				},
				Metadata: pageMetadata,
			})
		}
	}
	var expiresAt *time.Time
	if tokenResp.ExpiresIn > 0 {
		value := time.Now().UTC().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
		expiresAt = &value
	}
	return &exchangeResult{
		AuthSubjectID:        me.ID,
		AuthSubjectName:      me.Name,
		AccessToken:          tokenResp.AccessToken,
		TokenType:            tokenResp.TokenType,
		AccessTokenExpiresAt: expiresAt,
		Scopes:               a.DefaultScopes(),
		Metadata:             map[string]any{"pageCount": len(targets)},
		Targets:              targets,
	}, nil
}

func (a *metaAdapter) RefreshConnection(ctx context.Context, session providerSession) (*exchangeResult, error) {
	var me struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	if err := getJSON(ctx,
		fmt.Sprintf("https://graph.facebook.com/%s/me?fields=id,name&access_token=%s", a.cfg.MetaAPIVersion, url.QueryEscape(session.AccessToken)),
		nil,
		&me,
	); err != nil {
		return nil, err
	}
	return &exchangeResult{
		AuthSubjectID:   me.ID,
		AuthSubjectName: me.Name,
		AccessToken:     session.AccessToken,
		RefreshToken:    session.RefreshToken,
		TokenType:       "Bearer",
		Scopes:          session.Scopes,
		Metadata:        parseJSONMap(session.Connection.Metadata),
	}, nil
}

func (a *metaAdapter) ValidateTargetCapabilities(ctx context.Context, session providerSession, target database.SocialTarget) (*validateResult, error) {
	if target.TargetType == "facebook_page" {
		return &validateResult{
			Scopes:       parseJSONStringSlice(target.ScopeSnapshot),
			Capabilities: parseJSONMap(target.CapabilitySnapshot),
			Status:       targetStatusHealthy,
		}, nil
	}
	var account struct {
		ID       string `json:"id"`
		Username string `json:"username"`
	}
	if err := getJSON(ctx,
		fmt.Sprintf("https://graph.facebook.com/%s/%s?fields=id,username&access_token=%s", a.cfg.MetaAPIVersion, target.ExternalAccountID, url.QueryEscape(session.AccessToken)),
		nil,
		&account,
	); err != nil {
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

func (a *metaAdapter) PublishPost(ctx context.Context, session providerSession, target database.SocialTarget, content publishContent, assets []assetBlob) (*publishResult, error) {
	if target.TargetType == "instagram_professional" {
		return a.publishInstagram(ctx, session, target, content, assets)
	}
	return a.publishFacebookPage(ctx, session, target, content, assets)
}

func (a *metaAdapter) GetPostMetrics(ctx context.Context, session providerSession, target database.SocialTarget, publication database.PostVariantPublication) (*metricResult, error) {
	if publication.ExternalPostID == nil {
		return &metricResult{Metrics: map[string]float64{}, Metadata: map[string]any{}}, nil
	}
	token := a.targetAccessToken(target, session.AccessToken)
	if target.TargetType == "instagram_professional" {
		var media struct {
			ID            string  `json:"id"`
			Permalink     string  `json:"permalink"`
			LikeCount     float64 `json:"like_count"`
			CommentsCount float64 `json:"comments_count"`
		}
		if err := getJSON(ctx,
			fmt.Sprintf("https://graph.facebook.com/%s/%s?fields=id,permalink,like_count,comments_count&access_token=%s", a.cfg.MetaAPIVersion, *publication.ExternalPostID, url.QueryEscape(token)),
			nil,
			&media,
		); err != nil {
			return nil, err
		}
		return &metricResult{
			Metrics: map[string]float64{
				"likes":    media.LikeCount,
				"comments": media.CommentsCount,
			},
			Metadata: map[string]any{
				"provider":        "meta",
				"externalPostUrl": media.Permalink,
			},
		}, nil
	}
	var post struct {
		ID           string `json:"id"`
		PermalinkURL string `json:"permalink_url"`
		Likes        struct {
			Summary struct {
				TotalCount float64 `json:"total_count"`
			} `json:"summary"`
		} `json:"likes"`
		Comments struct {
			Summary struct {
				TotalCount float64 `json:"total_count"`
			} `json:"summary"`
		} `json:"comments"`
		Shares struct {
			Count float64 `json:"count"`
		} `json:"shares"`
	}
	if err := getJSON(ctx,
		fmt.Sprintf("https://graph.facebook.com/%s/%s?fields=id,permalink_url,likes.summary(true),comments.summary(true),shares&access_token=%s", a.cfg.MetaAPIVersion, *publication.ExternalPostID, url.QueryEscape(token)),
		nil,
		&post,
	); err != nil {
		return nil, err
	}
	return &metricResult{
		Metrics: map[string]float64{
			"likes":    post.Likes.Summary.TotalCount,
			"comments": post.Comments.Summary.TotalCount,
			"shares":   post.Shares.Count,
		},
		Metadata: map[string]any{
			"provider":        "meta",
			"externalPostUrl": post.PermalinkURL,
		},
	}, nil
}

func (a *metaAdapter) publishFacebookPage(ctx context.Context, session providerSession, target database.SocialTarget, content publishContent, assets []assetBlob) (*publishResult, error) {
	token := session.AccessToken
	if pageToken, ok := parseJSONMap(target.Metadata)["pageAccessToken"].(string); ok && strings.TrimSpace(pageToken) != "" {
		token = pageToken
	}
	if len(assets) == 0 {
		values := url.Values{
			"message":      []string{content.Caption},
			"access_token": []string{token},
		}
		resp, err := postForm(ctx, fmt.Sprintf("https://graph.facebook.com/%s/%s/feed", a.cfg.MetaAPIVersion, target.ExternalAccountID), values, nil)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		var payload struct {
			ID string `json:"id"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
			return nil, err
		}
		if strings.TrimSpace(payload.ID) == "" {
			return nil, fmt.Errorf("meta facebook feed publish did not return a post id")
		}
		return &publishResult{
			ExternalPostID:    payload.ID,
			ExternalAccountID: target.ExternalAccountID,
			PublishedAt:       time.Now().UTC(),
			Metadata: map[string]any{
				"mode":            "feed",
				"externalPostUrl": a.facebookPermalink(ctx, token, payload.ID),
			},
		}, nil
	}
	asset := assets[0]
	reader, err := asset.Open(ctx)
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	if asset.MediaKind == "video" {
		var payload struct {
			ID string `json:"id"`
		}
		if err := postMultipart(ctx,
			fmt.Sprintf("https://graph-video.facebook.com/%s/%s/videos", a.cfg.MetaAPIVersion, target.ExternalAccountID),
			map[string]string{"description": content.Caption, "access_token": token},
			"source",
			asset.OriginalName,
			reader,
			nil,
			&payload,
		); err != nil {
			return nil, err
		}
		return &publishResult{ExternalPostID: payload.ID, ExternalAccountID: target.ExternalAccountID, PublishedAt: time.Now().UTC(), Metadata: map[string]any{"mode": "video"}}, nil
	}
	var payload struct {
		PostID string `json:"post_id"`
		ID     string `json:"id"`
	}
	if err := postMultipart(ctx,
		fmt.Sprintf("https://graph.facebook.com/%s/%s/photos", a.cfg.MetaAPIVersion, target.ExternalAccountID),
		map[string]string{"caption": content.Caption, "access_token": token},
		"source",
		asset.OriginalName,
		reader,
		nil,
		&payload,
	); err != nil {
		return nil, err
	}
	postID := defaultString(payload.PostID, payload.ID)
	if strings.TrimSpace(postID) == "" {
		return nil, fmt.Errorf("meta facebook photo publish did not return a post id")
	}
	return &publishResult{
		ExternalPostID:    postID,
		ExternalAccountID: target.ExternalAccountID,
		PublishedAt:       time.Now().UTC(),
		Metadata: map[string]any{
			"mode":            "photo",
			"externalPostUrl": a.facebookPermalink(ctx, token, postID),
		},
	}, nil
}

func (a *metaAdapter) publishInstagram(ctx context.Context, session providerSession, target database.SocialTarget, content publishContent, assets []assetBlob) (*publishResult, error) {
	if len(assets) == 0 {
		return nil, fmt.Errorf("instagram publishing requires at least one asset")
	}
	instagramAssets, err := a.prepareInstagramAssets(ctx, assets)
	if err != nil {
		return nil, err
	}
	for _, asset := range instagramAssets {
		if !strings.HasPrefix(asset.PublicURL, "http://") && !strings.HasPrefix(asset.PublicURL, "https://") {
			return nil, fmt.Errorf("instagram publishing requires SOCIAL_PUBLIC_ASSET_BASE_URL so media URLs are publicly reachable")
		}
	}
	token := a.targetAccessToken(target, session.AccessToken)
	creationID, err := a.createInstagramMedia(ctx, token, target.ExternalAccountID, content, instagramAssets)
	if err != nil {
		return nil, err
	}
	publishResp, err := a.publishInstagramMedia(ctx, token, target.ExternalAccountID, creationID)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(creationID) == "" || strings.TrimSpace(publishResp.ID) == "" {
		return nil, fmt.Errorf("meta instagram publish did not return a media id")
	}
	return &publishResult{
		ExternalPostID:    publishResp.ID,
		ExternalAccountID: target.ExternalAccountID,
		PublishedAt:       time.Now().UTC(),
		Metadata: map[string]any{
			"creationId":      creationID,
			"externalPostUrl": a.instagramPermalink(ctx, token, publishResp.ID),
		},
	}, nil
}

type instagramPublishResponse struct {
	ID string `json:"id"`
}

func (a *metaAdapter) publishInstagramMedia(ctx context.Context, accessToken, accountID, creationID string) (*instagramPublishResponse, error) {
	values := url.Values{
		"creation_id":  []string{creationID},
		"access_token": []string{accessToken},
	}
	endpoint := fmt.Sprintf("https://graph.facebook.com/%s/%s/media_publish", a.cfg.MetaAPIVersion, accountID)

	delays := append([]time.Duration{0}, metaInstagramPublishRetryDelays...)
	for attempt, delay := range delays {
		if delay > 0 {
			if err := sleepWithContext(ctx, delay); err != nil {
				return nil, err
			}
		}
		resp, err := postForm(ctx, endpoint, values, nil)
		if err != nil {
			if isInstagramMediaNotReadyError(err) && attempt < len(delays)-1 {
				continue
			}
			if isInstagramMediaNotReadyError(err) {
				return nil, fmt.Errorf("meta instagram media was not ready for publishing after %d attempts: %w", len(delays), err)
			}
			return nil, err
		}
		var publishResp instagramPublishResponse
		if err := json.NewDecoder(resp.Body).Decode(&publishResp); err != nil {
			resp.Body.Close()
			return nil, err
		}
		resp.Body.Close()
		return &publishResp, nil
	}

	return nil, fmt.Errorf("meta instagram publish did not complete")
}

func isInstagramMediaNotReadyError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "media id is not available") ||
		strings.Contains(message, "2207027") ||
		(strings.Contains(message, "cannot publish") && strings.Contains(message, "not ready")) ||
		(strings.Contains(message, "oauthexception") && strings.Contains(message, "9007"))
}

func sleepWithContext(ctx context.Context, delay time.Duration) error {
	if delay <= 0 {
		return nil
	}
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func (a *metaAdapter) targetAccessToken(target database.SocialTarget, fallback string) string {
	if pageToken, ok := parseJSONMap(target.Metadata)["pageAccessToken"].(string); ok && strings.TrimSpace(pageToken) != "" {
		return pageToken
	}
	return fallback
}

func (a *metaAdapter) facebookPermalink(ctx context.Context, accessToken, postID string) string {
	if strings.TrimSpace(postID) == "" || strings.TrimSpace(accessToken) == "" {
		return ""
	}
	var payload struct {
		PermalinkURL string `json:"permalink_url"`
	}
	if err := getJSON(ctx,
		fmt.Sprintf("https://graph.facebook.com/%s/%s?fields=permalink_url&access_token=%s", a.cfg.MetaAPIVersion, postID, url.QueryEscape(accessToken)),
		nil,
		&payload,
	); err != nil {
		return ""
	}
	return strings.TrimSpace(payload.PermalinkURL)
}

func (a *metaAdapter) instagramPermalink(ctx context.Context, accessToken, mediaID string) string {
	if strings.TrimSpace(mediaID) == "" || strings.TrimSpace(accessToken) == "" {
		return ""
	}
	var payload struct {
		Permalink string `json:"permalink"`
	}
	if err := getJSON(ctx,
		fmt.Sprintf("https://graph.facebook.com/%s/%s?fields=permalink&access_token=%s", a.cfg.MetaAPIVersion, mediaID, url.QueryEscape(accessToken)),
		nil,
		&payload,
	); err != nil {
		return ""
	}
	return strings.TrimSpace(payload.Permalink)
}

func (a *metaAdapter) prepareInstagramAssets(ctx context.Context, assets []assetBlob) ([]assetBlob, error) {
	if strings.EqualFold(strings.TrimSpace(a.cfg.TempMediaProvider), "catbox") {
		result := make([]assetBlob, 0, len(assets))
		for _, asset := range assets {
			hostedURL, err := a.uploadAssetToCatbox(ctx, asset)
			if err != nil {
				return nil, err
			}
			asset.PublicURL = hostedURL
			result = append(result, asset)
		}
		return result, nil
	}
	return assets, nil
}

func (a *metaAdapter) uploadAssetToCatbox(ctx context.Context, asset assetBlob) (string, error) {
	reader, err := asset.Open(ctx)
	if err != nil {
		return "", err
	}
	defer reader.Close()

	buffer := &bytes.Buffer{}
	writer := multipart.NewWriter(buffer)
	if err := writer.WriteField("reqtype", "fileupload"); err != nil {
		return "", err
	}
	part, err := writer.CreateFormFile("fileToUpload", asset.OriginalName)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(part, reader); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://catbox.moe/user/api.php", buffer)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := socialHTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	payload, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("temp media upload failed (%d): %s", resp.StatusCode, strings.TrimSpace(string(payload)))
	}
	hostedURL := strings.TrimSpace(string(payload))
	if !strings.HasPrefix(hostedURL, "http://") && !strings.HasPrefix(hostedURL, "https://") {
		return "", fmt.Errorf("temp media upload returned an invalid public url")
	}
	return hostedURL, nil
}

func (a *metaAdapter) createInstagramMedia(ctx context.Context, accessToken, accountID string, content publishContent, assets []assetBlob) (string, error) {
	if len(assets) > 1 {
		children := make([]string, 0, len(assets))
		for _, asset := range assets {
			values := url.Values{"access_token": []string{accessToken}}
			if asset.MediaKind == "video" {
				values.Set("video_url", asset.PublicURL)
				values.Set("media_type", "VIDEO")
			} else {
				values.Set("image_url", asset.PublicURL)
			}
			values.Set("is_carousel_item", "true")
			resp, err := postForm(ctx, fmt.Sprintf("https://graph.facebook.com/%s/%s/media", a.cfg.MetaAPIVersion, accountID), values, nil)
			if err != nil {
				return "", err
			}
			var payload struct {
				ID string `json:"id"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
				resp.Body.Close()
				return "", err
			}
			resp.Body.Close()
			if strings.TrimSpace(payload.ID) == "" {
				return "", fmt.Errorf("meta instagram carousel child creation did not return a media id")
			}
			children = append(children, payload.ID)
		}
		values := url.Values{
			"caption":      []string{content.Caption},
			"media_type":   []string{"CAROUSEL"},
			"children":     []string{strings.Join(children, ",")},
			"access_token": []string{accessToken},
		}
		resp, err := postForm(ctx, fmt.Sprintf("https://graph.facebook.com/%s/%s/media", a.cfg.MetaAPIVersion, accountID), values, nil)
		if err != nil {
			return "", err
		}
		defer resp.Body.Close()
		var payload struct {
			ID string `json:"id"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
			return "", err
		}
		if strings.TrimSpace(payload.ID) == "" {
			return "", fmt.Errorf("meta instagram carousel creation did not return a media id")
		}
		return payload.ID, nil
	}
	asset := assets[0]
	values := url.Values{
		"caption":      []string{content.Caption},
		"access_token": []string{accessToken},
	}
	if asset.MediaKind == "video" {
		values.Set("video_url", asset.PublicURL)
		if content.Surface == "reel" {
			values.Set("media_type", "REELS")
		} else {
			values.Set("media_type", "VIDEO")
		}
	} else {
		values.Set("image_url", asset.PublicURL)
	}
	resp, err := postForm(ctx, fmt.Sprintf("https://graph.facebook.com/%s/%s/media", a.cfg.MetaAPIVersion, accountID), values, nil)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var payload struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", err
	}
	if strings.TrimSpace(payload.ID) == "" {
		return "", fmt.Errorf("meta instagram media creation did not return a media id")
	}
	return payload.ID, nil
}
