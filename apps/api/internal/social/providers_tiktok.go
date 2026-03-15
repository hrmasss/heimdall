package social

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/heimdall/api/internal/config"
	"github.com/heimdall/api/internal/database"
	"github.com/heimdall/api/internal/posts"
)

const (
	tikTokAuthorizeURL      = "https://www.tiktok.com/v2/auth/authorize/"
	tikTokTokenURL          = "https://open.tiktokapis.com/v2/oauth/token/"
	tikTokCreatorInfoURL    = "https://open.tiktokapis.com/v2/post/publish/creator_info/query/"
	tikTokVideoInitURL      = "https://open.tiktokapis.com/v2/post/publish/video/init/"
	tikTokPhotoInitURL      = "https://open.tiktokapis.com/v2/post/publish/content/init/"
	tikTokPublishStatusURL  = "https://open.tiktokapis.com/v2/post/publish/status/fetch/"
	tikTokVideoQueryBaseURL = "https://open.tiktokapis.com/v2/video/query/"
	tikTokPrivateVisibility = "SELF_ONLY"
	tikTokPhotoPostMode     = "DIRECT_POST"
	tikTokPhotoMediaType    = "PHOTO"
)

type tikTokAdapter struct {
	cfg config.SocialConfig
}

type tikTokCreatorInfo struct {
	CreatorAvatarURL        string   `json:"creator_avatar_url"`
	CreatorUsername         string   `json:"creator_username"`
	CreatorNickname         string   `json:"creator_nickname"`
	PrivacyLevelOptions     []string `json:"privacy_level_options"`
	CommentDisabled         bool     `json:"comment_disabled"`
	DuetDisabled            bool     `json:"duet_disabled"`
	StitchDisabled          bool     `json:"stitch_disabled"`
	MaxVideoPostDurationSec int      `json:"max_video_post_duration_sec"`
}

type tikTokPublishStatus struct {
	Status                   string `json:"status"`
	FailReason               string `json:"fail_reason"`
	UploadedBytes            int64  `json:"uploaded_bytes"`
	DownloadedBytes          int64  `json:"downloaded_bytes"`
	PublicallyAvailablePosts []any  `json:"publicaly_available_post_id"`
}

func newTikTokAdapter(cfg config.SocialConfig) providerAdapter {
	return &tikTokAdapter{cfg: cfg}
}

func (a *tikTokAdapter) Provider() string { return "tiktok" }
func (a *tikTokAdapter) Label() string    { return "TikTok" }
func (a *tikTokAdapter) DefaultScopes() []string {
	return []string{"user.info.basic", "user.info.profile", "video.publish", "video.list"}
}
func (a *tikTokAdapter) SupportsBYOK() bool { return true }

func (a *tikTokAdapter) BuildAuthorizationURL(credential providerCredential, redirectURI string, state database.SocialOAuthState) (string, error) {
	query := url.Values{
		"client_key":    []string{credential.ClientID},
		"response_type": []string{"code"},
		"scope":         []string{strings.Join(a.DefaultScopes(), ",")},
		"redirect_uri":  []string{redirectURI},
		"state":         []string{state.StateToken},
	}
	return tikTokAuthorizeURL + "?" + query.Encode(), nil
}

func (a *tikTokAdapter) ExchangeCode(ctx context.Context, credential providerCredential, redirectURI string, state database.SocialOAuthState, code string) (*exchangeResult, error) {
	tokenResp, err := a.exchangeToken(ctx, credential, url.Values{
		"client_key":    []string{credential.ClientID},
		"client_secret": []string{credential.ClientSecret},
		"code":          []string{code},
		"grant_type":    []string{"authorization_code"},
		"redirect_uri":  []string{redirectURI},
	})
	if err != nil {
		return nil, err
	}
	creatorInfo, err := a.queryCreatorInfo(ctx, tokenResp.AccessToken)
	if err != nil {
		return nil, err
	}
	target := discoveredTarget{
		ExternalAccountID:     tokenResp.OpenID,
		DisplayName:           defaultString(creatorInfo.CreatorNickname, "TikTok account"),
		Username:              creatorInfo.CreatorUsername,
		TargetType:            "tiktok_account",
		AccountClassification: "creator",
		Scopes:                splitTikTokScopes(tokenResp.Scope),
		Status:                targetStatusHealthy,
		Capabilities:          a.capabilitiesForSource(credential.Source),
		Metadata: map[string]any{
			"creatorAvatarUrl": creatorInfo.CreatorAvatarURL,
			"creatorNickname":  creatorInfo.CreatorNickname,
			"creatorUsername":  creatorInfo.CreatorUsername,
			"credentialSource": credential.Source,
		},
	}
	return &exchangeResult{
		AuthSubjectID:        tokenResp.OpenID,
		AuthSubjectName:      defaultString(creatorInfo.CreatorNickname, "TikTok account"),
		AccessToken:          tokenResp.AccessToken,
		RefreshToken:         tokenResp.RefreshToken,
		TokenType:            defaultString(tokenResp.TokenType, "Bearer"),
		AccessTokenExpiresAt: expiresAtFromNow(tokenResp.ExpiresIn),
		Scopes:               splitTikTokScopes(tokenResp.Scope),
		Metadata: map[string]any{
			"creatorAvatarUrl": creatorInfo.CreatorAvatarURL,
			"creatorNickname":  creatorInfo.CreatorNickname,
			"creatorUsername":  creatorInfo.CreatorUsername,
			"openId":           tokenResp.OpenID,
		},
		Targets: []discoveredTarget{target},
	}, nil
}

func (a *tikTokAdapter) RefreshConnection(ctx context.Context, session providerSession) (*exchangeResult, error) {
	tokenResp, err := a.exchangeToken(ctx, session.Credential, url.Values{
		"client_key":    []string{session.Credential.ClientID},
		"client_secret": []string{session.Credential.ClientSecret},
		"grant_type":    []string{"refresh_token"},
		"refresh_token": []string{session.RefreshToken},
	})
	if err != nil {
		return nil, err
	}
	creatorInfo, err := a.queryCreatorInfo(ctx, tokenResp.AccessToken)
	if err != nil {
		return nil, err
	}
	return &exchangeResult{
		AuthSubjectID:        defaultString(tokenResp.OpenID, session.Connection.AuthSubjectID),
		AuthSubjectName:      defaultString(creatorInfo.CreatorNickname, session.Connection.AuthSubjectName),
		AccessToken:          tokenResp.AccessToken,
		RefreshToken:         defaultString(tokenResp.RefreshToken, session.RefreshToken),
		TokenType:            defaultString(tokenResp.TokenType, "Bearer"),
		AccessTokenExpiresAt: expiresAtFromNow(tokenResp.ExpiresIn),
		Scopes:               splitTikTokScopes(tokenResp.Scope),
		Metadata: map[string]any{
			"creatorAvatarUrl": creatorInfo.CreatorAvatarURL,
			"creatorNickname":  creatorInfo.CreatorNickname,
			"creatorUsername":  creatorInfo.CreatorUsername,
			"openId":           defaultString(tokenResp.OpenID, session.Connection.AuthSubjectID),
		},
		Targets: []discoveredTarget{{
			ExternalAccountID:     defaultString(tokenResp.OpenID, session.Connection.AuthSubjectID),
			DisplayName:           defaultString(creatorInfo.CreatorNickname, session.Connection.AuthSubjectName),
			Username:              creatorInfo.CreatorUsername,
			TargetType:            "tiktok_account",
			AccountClassification: "creator",
			Scopes:                splitTikTokScopes(tokenResp.Scope),
			Status:                targetStatusHealthy,
			Capabilities:          a.capabilitiesForSource(session.Credential.Source),
			Metadata: map[string]any{
				"creatorAvatarUrl": creatorInfo.CreatorAvatarURL,
				"creatorNickname":  creatorInfo.CreatorNickname,
				"creatorUsername":  creatorInfo.CreatorUsername,
				"credentialSource": session.Credential.Source,
			},
		}},
	}, nil
}

func (a *tikTokAdapter) ValidateTargetCapabilities(ctx context.Context, session providerSession, target database.SocialTarget) (*validateResult, error) {
	_, err := a.queryCreatorInfo(ctx, session.AccessToken)
	if err != nil {
		return &validateResult{
			Scopes:       parseJSONStringSlice(target.ScopeSnapshot),
			Capabilities: parseJSONMap(target.CapabilitySnapshot),
			Status:       targetStatusReauth,
			Error:        err.Error(),
		}, nil
	}
	return &validateResult{
		Scopes:       session.Scopes,
		Capabilities: a.capabilitiesForSource(session.Credential.Source),
		Status:       targetStatusHealthy,
		Error:        "",
	}, nil
}

func (a *tikTokAdapter) BuildPreviewMetadata(ctx context.Context, session providerSession, _ database.SocialTarget, content publishContent, _ []assetBlob) (map[string]any, []posts.ReadinessIssue, []posts.ReadinessIssue, error) {
	info, err := a.queryCreatorInfo(ctx, session.AccessToken)
	if err != nil {
		return nil, nil, nil, err
	}
	issues := make([]posts.ReadinessIssue, 0, 2)
	warnings := make([]posts.ReadinessIssue, 0, 1)
	if len(info.PrivacyLevelOptions) == 1 && info.PrivacyLevelOptions[0] == tikTokPrivateVisibility {
		warnings = append(warnings, posts.ReadinessIssue{
			Code:    "tiktok_private_only",
			Message: "This TikTok app is currently restricted to private SELF_ONLY posting.",
		})
	}
	return map[string]any{
		"tiktok": map[string]any{
			"creatorAvatarUrl":    info.CreatorAvatarURL,
			"creatorNickname":     info.CreatorNickname,
			"creatorUsername":     info.CreatorUsername,
			"privacyLevels":       info.PrivacyLevelOptions,
			"maxVideoDurationSec": info.MaxVideoPostDurationSec,
			"commentAllowed":      !info.CommentDisabled,
			"duetAllowed":         !info.DuetDisabled,
			"stitchAllowed":       !info.StitchDisabled,
			"isSelfOnly":          len(info.PrivacyLevelOptions) == 1 && info.PrivacyLevelOptions[0] == tikTokPrivateVisibility,
			"credentialSource":    session.Credential.Source,
		},
	}, issues, warnings, nil
}

func (a *tikTokAdapter) PublishPost(ctx context.Context, session providerSession, target database.SocialTarget, content publishContent, assets []assetBlob) (*publishResult, error) {
	info, err := a.queryCreatorInfo(ctx, session.AccessToken)
	if err != nil {
		return nil, err
	}
	options, err := a.resolvePublishOptions(content, session.Credential.Source, info)
	if err != nil {
		return nil, err
	}
	switch content.Surface {
	case "photo_post":
		if session.Credential.Source != credentialSourceManaged {
			return nil, fmt.Errorf("tiktok photo posting requires Heimdall-managed app credentials in MVP")
		}
		if len(assets) == 0 {
			return nil, fmt.Errorf("tiktok photo posts require at least one image")
		}
		photoURLs := make([]string, 0, len(assets))
		for _, asset := range assets {
			if asset.MediaKind != "image" {
				continue
			}
			photoURLs = append(photoURLs, asset.PublicURL)
		}
		if len(photoURLs) == 0 {
			return nil, fmt.Errorf("tiktok photo posts require at least one image")
		}
		initResp := struct {
			PublishID string `json:"publish_id"`
		}{}
		if err := a.postTikTokJSON(ctx, tikTokPhotoInitURL, map[string]any{
			"media_type": tikTokPhotoMediaType,
			"post_mode":  tikTokPhotoPostMode,
			"post_info": map[string]any{
				"title":                truncateTikTokText(content.Title, 90),
				"description":          truncateTikTokText(content.Caption, 4000),
				"privacy_level":        options.PrivacyLevel,
				"disable_comment":      !options.AllowComment,
				"auto_add_music":       true,
				"brand_content_toggle": options.BrandContent,
				"brand_organic_toggle": options.BrandedContent,
			},
			"source_info": map[string]any{
				"source":            "PULL_FROM_URL",
				"photo_cover_index": 0,
				"photo_images":      photoURLs,
			},
		}, session.AccessToken, &initResp); err != nil {
			return nil, err
		}
		return &publishResult{
			ExternalAccountID: target.ExternalAccountID,
			PublishedAt:       time.Now().UTC(),
			Metadata: map[string]any{
				"provider":         "tiktok",
				"publishId":        initResp.PublishID,
				"publishStatus":    "accepted",
				"privacyLevel":     options.PrivacyLevel,
				"credentialSource": session.Credential.Source,
			},
		}, nil
	case "video_post":
		if len(assets) == 0 {
			return nil, fmt.Errorf("tiktok video posts require one video asset")
		}
		asset := firstAssetByKind(assets, "video")
		if asset == nil {
			return nil, fmt.Errorf("tiktok video posts require one video asset")
		}
		payload := map[string]any{
			"post_info": map[string]any{
				"title":                truncateTikTokText(content.Caption, 2200),
				"privacy_level":        options.PrivacyLevel,
				"disable_duet":         !options.AllowDuet,
				"disable_comment":      !options.AllowComment,
				"disable_stitch":       !options.AllowStitch,
				"brand_content_toggle": options.BrandContent,
				"brand_organic_toggle": options.BrandedContent,
			},
		}
		sourceInfo := map[string]any{}
		if session.Credential.Source == credentialSourceManaged {
			sourceInfo["source"] = "PULL_FROM_URL"
			sourceInfo["video_url"] = asset.PublicURL
		} else {
			sourceInfo["source"] = "FILE_UPLOAD"
			sourceInfo["video_size"] = asset.SizeBytes
			sourceInfo["chunk_size"] = asset.SizeBytes
			sourceInfo["total_chunk_count"] = 1
		}
		payload["source_info"] = sourceInfo
		initResp := struct {
			PublishID string `json:"publish_id"`
			UploadURL string `json:"upload_url"`
		}{}
		if err := a.postTikTokJSON(ctx, tikTokVideoInitURL, payload, session.AccessToken, &initResp); err != nil {
			return nil, err
		}
		if strings.TrimSpace(initResp.UploadURL) != "" {
			reader, err := asset.Open(ctx)
			if err != nil {
				return nil, err
			}
			defer reader.Close()
			headers := map[string]string{
				"Content-Range":  fmt.Sprintf("bytes 0-%d/%d", asset.SizeBytes-1, asset.SizeBytes),
				"Content-Length": strconv.FormatInt(asset.SizeBytes, 10),
			}
			if err := putStream(ctx, initResp.UploadURL, asset.MIMEType, reader, headers); err != nil {
				return nil, err
			}
		}
		return &publishResult{
			ExternalAccountID: target.ExternalAccountID,
			PublishedAt:       time.Now().UTC(),
			Metadata: map[string]any{
				"provider":         "tiktok",
				"publishId":        initResp.PublishID,
				"publishStatus":    "accepted",
				"privacyLevel":     options.PrivacyLevel,
				"credentialSource": session.Credential.Source,
			},
		}, nil
	default:
		return nil, fmt.Errorf("tiktok does not support surface %s", content.Surface)
	}
}

func (a *tikTokAdapter) GetPostMetrics(ctx context.Context, session providerSession, target database.SocialTarget, publication database.PostVariantPublication) (*metricResult, error) {
	metadata := parseJSONMap(publication.Metadata)
	publishID := stringValue(metadata["publishId"])
	if publishID == "" {
		if nested := parseJSONAnyMap(metadata["publishResult"]); nested != nil {
			publishID = stringValue(nested["publishId"])
		}
	}
	if publishID == "" {
		return &metricResult{Metrics: map[string]float64{}, Metadata: map[string]any{}}, nil
	}
	status, err := a.fetchPublishStatus(ctx, session.AccessToken, publishID)
	if err != nil {
		return nil, err
	}
	resultMetadata := map[string]any{
		"provider":        "tiktok",
		"publishId":       publishID,
		"publishStatus":   status.Status,
		"failReason":      status.FailReason,
		"uploadedBytes":   status.UploadedBytes,
		"downloadedBytes": status.DownloadedBytes,
	}
	postID := firstTikTokPublicPostID(status.PublicallyAvailablePosts)
	if postID == "" {
		return &metricResult{Metrics: map[string]float64{}, Metadata: resultMetadata}, nil
	}
	resultMetadata["externalPostId"] = postID
	video, err := a.queryVideo(ctx, session.AccessToken, postID)
	if err != nil {
		return nil, err
	}
	if video.ShareURL != "" {
		resultMetadata["externalPostUrl"] = video.ShareURL
	}
	return &metricResult{
		Metrics: map[string]float64{
			"likes":       video.LikeCount,
			"comments":    video.CommentCount,
			"shares":      video.ShareCount,
			"video_views": video.ViewCount,
		},
		Metadata: resultMetadata,
	}, nil
}

type tikTokTokenResponse struct {
	AccessToken  string `json:"access_token"`
	ExpiresIn    int64  `json:"expires_in"`
	OpenID       string `json:"open_id"`
	RefreshToken string `json:"refresh_token"`
	Scope        string `json:"scope"`
	TokenType    string `json:"token_type"`
}

type tikTokVideo struct {
	ID           string  `json:"id"`
	ShareURL     string  `json:"share_url"`
	LikeCount    float64 `json:"like_count"`
	CommentCount float64 `json:"comment_count"`
	ShareCount   float64 `json:"share_count"`
	ViewCount    float64 `json:"view_count"`
}

func (a *tikTokAdapter) capabilitiesForSource(source string) map[string]any {
	allowed := []string{"video_post"}
	if source == credentialSourceManaged {
		allowed = append(allowed, "photo_post")
	}
	return map[string]any{
		"allowedSurfaces": allowed,
	}
}

func (a *tikTokAdapter) exchangeToken(ctx context.Context, _ providerCredential, values url.Values) (*tikTokTokenResponse, error) {
	resp, err := postForm(ctx, tikTokTokenURL, values, map[string]string{"Cache-Control": "no-cache"})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var tokenResp tikTokTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, err
	}
	return &tokenResp, nil
}

func (a *tikTokAdapter) queryCreatorInfo(ctx context.Context, accessToken string) (*tikTokCreatorInfo, error) {
	resp := tikTokCreatorInfo{}
	if err := a.postTikTokJSON(ctx, tikTokCreatorInfoURL, map[string]any{}, accessToken, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (a *tikTokAdapter) resolvePublishOptions(content publishContent, source string, info *tikTokCreatorInfo) (*tikTokResolvedOptions, error) {
	options := &tikTokResolvedOptions{
		PrivacyLevel:   defaultTikTokPrivacyLevel(info.PrivacyLevelOptions),
		AllowComment:   !info.CommentDisabled,
		AllowDuet:      !info.DuetDisabled,
		AllowStitch:    !info.StitchDisabled,
		BrandContent:   false,
		BrandedContent: false,
	}
	if content.TikTok != nil {
		if privacy := strings.TrimSpace(content.TikTok.PrivacyLevel); privacy != "" {
			options.PrivacyLevel = privacy
		}
		if content.TikTok.AllowComment != nil {
			options.AllowComment = *content.TikTok.AllowComment
		}
		if content.TikTok.AllowDuet != nil {
			options.AllowDuet = *content.TikTok.AllowDuet
		}
		if content.TikTok.AllowStitch != nil {
			options.AllowStitch = *content.TikTok.AllowStitch
		}
		if content.TikTok.BrandContent != nil {
			options.BrandContent = *content.TikTok.BrandContent
		}
		if content.TikTok.BrandedContent != nil {
			options.BrandedContent = *content.TikTok.BrandedContent
		}
	}
	if !containsString(info.PrivacyLevelOptions, options.PrivacyLevel) {
		return nil, fmt.Errorf("tiktok privacy level %q is not allowed for this account", options.PrivacyLevel)
	}
	if info.CommentDisabled {
		options.AllowComment = false
	}
	if info.DuetDisabled {
		options.AllowDuet = false
	}
	if info.StitchDisabled {
		options.AllowStitch = false
	}
	if source == credentialSourceBYOK && content.Surface == "photo_post" {
		return nil, fmt.Errorf("tiktok photo posting requires Heimdall-managed app credentials in MVP")
	}
	return options, nil
}

type tikTokResolvedOptions struct {
	PrivacyLevel   string
	AllowComment   bool
	AllowDuet      bool
	AllowStitch    bool
	BrandContent   bool
	BrandedContent bool
}

func (a *tikTokAdapter) fetchPublishStatus(ctx context.Context, accessToken, publishID string) (*tikTokPublishStatus, error) {
	var payload struct {
		Data  tikTokPublishStatus `json:"data"`
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := a.postTikTokJSON(ctx, tikTokPublishStatusURL, map[string]any{"publish_id": publishID}, accessToken, &payload.Data); err != nil {
		return nil, err
	}
	return &payload.Data, nil
}

func (a *tikTokAdapter) queryVideo(ctx context.Context, accessToken, postID string) (*tikTokVideo, error) {
	endpoint := tikTokVideoQueryBaseURL + "?fields=" + url.QueryEscape("id,share_url,like_count,comment_count,share_count,view_count")
	var payload struct {
		Data struct {
			Videos []tikTokVideo `json:"videos"`
		} `json:"data"`
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := a.postTikTokJSON(ctx, endpoint, map[string]any{
		"filters": map[string]any{
			"video_ids": []string{postID},
		},
	}, accessToken, &payload.Data); err != nil {
		return nil, err
	}
	if len(payload.Data.Videos) == 0 {
		return &tikTokVideo{ID: postID}, nil
	}
	return &payload.Data.Videos[0], nil
}

func (a *tikTokAdapter) postTikTokJSON(ctx context.Context, endpoint string, payload any, accessToken string, out any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json; charset=UTF-8")
	resp, err := socialHTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 8192))
	if err != nil {
		return err
	}
	if resp.StatusCode >= 400 {
		return fmt.Errorf("provider request failed (%d): %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}
	var envelope struct {
		Data  json.RawMessage `json:"data"`
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(respBody, &envelope); err != nil {
		return err
	}
	if code := strings.TrimSpace(envelope.Error.Code); code != "" && code != "ok" {
		return fmt.Errorf("tiktok request failed (%s): %s", code, strings.TrimSpace(envelope.Error.Message))
	}
	if out == nil || len(envelope.Data) == 0 {
		return nil
	}
	return json.Unmarshal(envelope.Data, out)
}

func defaultTikTokPrivacyLevel(options []string) string {
	if len(options) == 0 {
		return tikTokPrivateVisibility
	}
	if containsString(options, tikTokPrivateVisibility) {
		return tikTokPrivateVisibility
	}
	return strings.TrimSpace(options[0])
}

func splitTikTokScopes(value string) []string {
	parts := strings.Split(value, ",")
	scopes := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			scopes = append(scopes, part)
		}
	}
	return scopes
}

func expiresAtFromNow(seconds int64) *time.Time {
	if seconds <= 0 {
		return nil
	}
	value := time.Now().UTC().Add(time.Duration(seconds) * time.Second)
	return &value
}

func containsString(values []string, want string) bool {
	want = strings.TrimSpace(want)
	for _, value := range values {
		if strings.TrimSpace(value) == want {
			return true
		}
	}
	return false
}

func firstAssetByKind(assets []assetBlob, kind string) *assetBlob {
	for index := range assets {
		if assets[index].MediaKind == kind {
			return &assets[index]
		}
	}
	return nil
}

func firstTikTokPublicPostID(values []any) string {
	for _, value := range values {
		switch typed := value.(type) {
		case string:
			if strings.TrimSpace(typed) != "" {
				return typed
			}
		case float64:
			return strconv.FormatInt(int64(typed), 10)
		case json.Number:
			return typed.String()
		}
	}
	return ""
}

func truncateTikTokText(value string, limit int) string {
	value = strings.TrimSpace(value)
	if limit <= 0 || len(value) <= limit {
		return value
	}
	return value[:limit]
}
