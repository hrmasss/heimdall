package social

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"strings"
	"time"

	"github.com/heimdall/api/internal/config"
	"github.com/heimdall/api/internal/database"
)

type metaAdapter struct {
	cfg config.SocialConfig
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
		"instagram_business_content_publish",
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
				Scopes:                []string{"instagram_basic", "instagram_business_content_publish"},
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
	if target.TargetType == "instagram_professional" {
		var media struct {
			LikeCount     float64 `json:"like_count"`
			CommentsCount float64 `json:"comments_count"`
		}
		if err := getJSON(ctx,
			fmt.Sprintf("https://graph.facebook.com/%s/%s?fields=like_count,comments_count&access_token=%s", a.cfg.MetaAPIVersion, *publication.ExternalPostID, url.QueryEscape(session.AccessToken)),
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
			Metadata: map[string]any{"provider": "meta"},
		}, nil
	}
	var post struct {
		Likes struct {
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
		fmt.Sprintf("https://graph.facebook.com/%s/%s?fields=likes.summary(true),comments.summary(true),shares&access_token=%s", a.cfg.MetaAPIVersion, *publication.ExternalPostID, url.QueryEscape(session.AccessToken)),
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
		Metadata: map[string]any{"provider": "meta"},
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
		return &publishResult{ExternalPostID: payload.ID, ExternalAccountID: target.ExternalAccountID, PublishedAt: time.Now().UTC(), Metadata: map[string]any{"mode": "feed"}}, nil
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
	return &publishResult{ExternalPostID: defaultString(payload.PostID, payload.ID), ExternalAccountID: target.ExternalAccountID, PublishedAt: time.Now().UTC(), Metadata: map[string]any{"mode": "photo"}}, nil
}

func (a *metaAdapter) publishInstagram(ctx context.Context, session providerSession, target database.SocialTarget, content publishContent, assets []assetBlob) (*publishResult, error) {
	if len(assets) == 0 {
		return nil, fmt.Errorf("instagram publishing requires at least one asset")
	}
	for _, asset := range assets {
		if !strings.HasPrefix(asset.PublicURL, "http://") && !strings.HasPrefix(asset.PublicURL, "https://") {
			return nil, fmt.Errorf("instagram publishing requires SOCIAL_PUBLIC_ASSET_BASE_URL so media URLs are publicly reachable")
		}
	}
	creationID, err := a.createInstagramMedia(ctx, session.AccessToken, target.ExternalAccountID, content, assets)
	if err != nil {
		return nil, err
	}
	values := url.Values{
		"creation_id":  []string{creationID},
		"access_token": []string{session.AccessToken},
	}
	resp, err := postForm(ctx, fmt.Sprintf("https://graph.facebook.com/%s/%s/media_publish", a.cfg.MetaAPIVersion, target.ExternalAccountID), values, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var publishResp struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&publishResp); err != nil {
		return nil, err
	}
	return &publishResult{
		ExternalPostID:    publishResp.ID,
		ExternalAccountID: target.ExternalAccountID,
		PublishedAt:       time.Now().UTC(),
		Metadata:          map[string]any{"creationId": creationID},
	}, nil
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
	return payload.ID, nil
}
