package social

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/heimdall/api/internal/config"
	"github.com/heimdall/api/internal/database"
)

type linkedInAdapter struct {
	cfg config.SocialConfig
}

func newLinkedInAdapter(cfg config.SocialConfig) providerAdapter {
	return &linkedInAdapter{cfg: cfg}
}

func (a *linkedInAdapter) Provider() string { return "linkedin" }
func (a *linkedInAdapter) Label() string    { return "LinkedIn" }
func (a *linkedInAdapter) DefaultScopes() []string {
	return []string{"w_organization_social", "r_organization_social", "rw_organization_admin"}
}
func (a *linkedInAdapter) SupportsBYOK() bool { return true }

func (a *linkedInAdapter) BuildAuthorizationURL(credential providerCredential, redirectURI string, state database.SocialOAuthState) (string, error) {
	query := url.Values{
		"response_type": []string{"code"},
		"client_id":     []string{credential.ClientID},
		"redirect_uri":  []string{redirectURI},
		"state":         []string{state.StateToken},
		"scope":         []string{strings.Join(a.DefaultScopes(), " ")},
	}
	return "https://www.linkedin.com/oauth/v2/authorization?" + query.Encode(), nil
}

func (a *linkedInAdapter) ExchangeCode(ctx context.Context, credential providerCredential, redirectURI string, state database.SocialOAuthState, code string) (*exchangeResult, error) {
	values := url.Values{
		"grant_type":    []string{"authorization_code"},
		"code":          []string{code},
		"client_id":     []string{credential.ClientID},
		"client_secret": []string{credential.ClientSecret},
		"redirect_uri":  []string{redirectURI},
	}
	resp, err := postForm(ctx, "https://www.linkedin.com/oauth/v2/accessToken", values, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("linkedin token exchange failed (%d): %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var tokenResp struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int64  `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, err
	}
	headers := a.headers(tokenResp.AccessToken)
	var userInfo struct {
		Sub   string `json:"sub"`
		Name  string `json:"name"`
		Email string `json:"email"`
	}
	_ = getJSON(ctx, "https://api.linkedin.com/v2/userinfo", headers, &userInfo)
	targets, roleAssignee, err := a.discoverTargets(ctx, headers)
	if err != nil {
		return nil, err
	}
	var expiresAt *time.Time
	if tokenResp.ExpiresIn > 0 {
		value := time.Now().UTC().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
		expiresAt = &value
	}
	authSubjectID := defaultString(userInfo.Sub, roleAssignee)
	if authSubjectID == "" {
		authSubjectID = "linkedin-member"
	}
	authSubjectName := defaultString(userInfo.Name, userInfo.Email)
	if authSubjectName == "" {
		authSubjectName = "LinkedIn account"
	}
	return &exchangeResult{
		AuthSubjectID:        authSubjectID,
		AuthSubjectName:      authSubjectName,
		AccessToken:          tokenResp.AccessToken,
		TokenType:            "Bearer",
		AccessTokenExpiresAt: expiresAt,
		Scopes:               a.DefaultScopes(),
		Metadata: map[string]any{
			"organizationCount": len(targets),
			"roleAssignee":      roleAssignee,
		},
		Targets:              targets,
	}, nil
}

func (a *linkedInAdapter) RefreshConnection(ctx context.Context, session providerSession) (*exchangeResult, error) {
	var userInfo struct {
		Sub  string `json:"sub"`
		Name string `json:"name"`
	}
	_ = getJSON(ctx, "https://api.linkedin.com/v2/userinfo", a.headers(session.AccessToken), &userInfo)
	return &exchangeResult{
		AuthSubjectID:   defaultString(userInfo.Sub, session.Connection.AuthSubjectID),
		AuthSubjectName: defaultString(userInfo.Name, session.Connection.AuthSubjectName),
		AccessToken:     session.AccessToken,
		RefreshToken:    session.RefreshToken,
		TokenType:       "Bearer",
		Scopes:          session.Scopes,
		Metadata:        parseJSONMap(session.Connection.Metadata),
	}, nil
}

func (a *linkedInAdapter) ValidateTargetCapabilities(ctx context.Context, session providerSession, target database.SocialTarget) (*validateResult, error) {
	headers := a.headers(session.AccessToken)
	var org struct {
		ID   int64  `json:"id"`
		Name string `json:"localizedName"`
	}
	if err := getJSON(ctx, fmt.Sprintf("https://api.linkedin.com/rest/organizations/%s", target.ExternalAccountID), headers, &org); err != nil {
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

func (a *linkedInAdapter) PublishPost(ctx context.Context, session providerSession, target database.SocialTarget, content publishContent, assets []assetBlob) (*publishResult, error) {
	headers := a.headers(session.AccessToken)
	author := fmt.Sprintf("urn:li:organization:%s", target.ExternalAccountID)
	postPayload := map[string]any{
		"author":     author,
		"commentary": content.Caption,
		"visibility": "PUBLIC",
		"distribution": map[string]any{
			"feedDistribution":               "MAIN_FEED",
			"targetEntities":                 []any{},
			"thirdPartyDistributionChannels": []any{},
		},
		"lifecycleState":            "PUBLISHED",
		"isReshareDisabledByAuthor": false,
	}

	if len(assets) > 0 {
		switch assets[0].MediaKind {
		case "image":
			urns := make([]string, 0, len(assets))
			for _, asset := range assets {
				urn, err := a.uploadImage(ctx, headers, target.ExternalAccountID, asset)
				if err != nil {
					return nil, err
				}
				urns = append(urns, urn)
			}
			if len(urns) == 1 {
				postPayload["content"] = map[string]any{"media": map[string]any{"id": urns[0]}}
			} else {
				postPayload["content"] = map[string]any{"multiImage": map[string]any{"images": urns}}
			}
		case "video":
			urn, err := a.uploadVideo(ctx, headers, target.ExternalAccountID, assets[0])
			if err != nil {
				return nil, err
			}
			postPayload["content"] = map[string]any{"media": map[string]any{"id": urn}}
		case "document":
			urn, err := a.uploadDocument(ctx, headers, target.ExternalAccountID, assets[0])
			if err != nil {
				return nil, err
			}
			postPayload["content"] = map[string]any{"media": map[string]any{"id": urn}}
		}
	}

	restliID, err := a.createPost(ctx, headers, postPayload)
	if err != nil {
		return nil, err
	}
	return &publishResult{
		ExternalPostID:    restliID,
		ExternalAccountID: target.ExternalAccountID,
		PublishedAt:       time.Now().UTC(),
		Metadata: map[string]any{
			"author":          author,
			"externalPostUrl": a.postPermalink(restliID),
		},
	}, nil
}

func (a *linkedInAdapter) GetPostMetrics(ctx context.Context, session providerSession, target database.SocialTarget, publication database.PostVariantPublication) (*metricResult, error) {
	if publication.ExternalPostID == nil {
		return &metricResult{Metrics: map[string]float64{}, Metadata: map[string]any{}}, nil
	}
	var metadata struct {
		CommentSummary struct {
			Count float64 `json:"count"`
		} `json:"commentSummary"`
		ReactionSummary struct {
			Count float64 `json:"count"`
		} `json:"reactionSummary"`
		ShareSummary struct {
			Count float64 `json:"count"`
		} `json:"shareSummary"`
	}
	if err := a.getSocialMetadata(ctx, defaultString(*publication.ExternalPostID, ""), a.headers(session.AccessToken), &metadata); err != nil {
		return nil, err
	}
	return &metricResult{
		Metrics: map[string]float64{
			"comments": metadata.CommentSummary.Count,
			"likes":    metadata.ReactionSummary.Count,
			"shares":   metadata.ShareSummary.Count,
		},
		Metadata: map[string]any{"provider": "linkedin"},
	}, nil
}

func (a *linkedInAdapter) headers(accessToken string) map[string]string {
	return map[string]string{
		"Authorization":             "Bearer " + accessToken,
		"LinkedIn-Version":          a.cfg.LinkedInVersion,
		"X-Restli-Protocol-Version": "2.0.0",
	}
}

func (a *linkedInAdapter) postPermalink(externalPostID string) string {
	externalPostID = strings.TrimSpace(externalPostID)
	if externalPostID == "" {
		return ""
	}
	return fmt.Sprintf("https://www.linkedin.com/feed/update/%s/", externalPostID)
}

func (a *linkedInAdapter) createPost(ctx context.Context, headers map[string]string, payload map[string]any) (string, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.linkedin.com/rest/posts", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	resp, err := socialHTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		payload, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return "", fmt.Errorf("provider request failed (%d): %s", resp.StatusCode, strings.TrimSpace(string(payload)))
	}
	restliID := strings.TrimSpace(resp.Header.Get("x-restli-id"))
	if restliID != "" {
		return restliID, nil
	}
	var response struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil && err != io.EOF {
		return "", err
	}
	if strings.TrimSpace(response.ID) == "" {
		return "", fmt.Errorf("linkedin publish did not return a post id")
	}
	return response.ID, nil
}

func (a *linkedInAdapter) getSocialMetadata(ctx context.Context, externalPostID string, headers map[string]string, out any) error {
	externalPostID = strings.TrimSpace(externalPostID)
	candidates := []string{
		fmt.Sprintf("https://api.linkedin.com/rest/socialMetadata/%s", externalPostID),
		fmt.Sprintf("https://api.linkedin.com/rest/socialMetadata/%s", url.PathEscape(externalPostID)),
	}
	var lastErr error
	for _, endpoint := range candidates {
		if err := getJSON(ctx, endpoint, headers, out); err == nil {
			return nil
		} else {
			lastErr = err
		}
	}
	return lastErr
}

func (a *linkedInAdapter) discoverTargets(ctx context.Context, headers map[string]string) ([]discoveredTarget, string, error) {
	var aclResp struct {
		Elements []struct {
			Organization string `json:"organization"`
			Role         string `json:"role"`
			State        string `json:"state"`
			RoleAssignee string `json:"roleAssignee"`
		} `json:"elements"`
	}
	if err := getJSON(ctx, "https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&state=APPROVED", headers, &aclResp); err != nil {
		return nil, "", err
	}
	targets := make([]discoveredTarget, 0, len(aclResp.Elements))
	roleAssignee := ""
	for _, acl := range aclResp.Elements {
		if roleAssignee == "" {
			roleAssignee = strings.TrimSpace(acl.RoleAssignee)
		}
		orgID := strings.TrimPrefix(acl.Organization, "urn:li:organization:")
		var org struct {
			ID               int64  `json:"id"`
			Name             string `json:"localizedName"`
			VanityName       string `json:"vanityName"`
			OrganizationType string `json:"organizationType"`
		}
		if err := getJSON(ctx, fmt.Sprintf("https://api.linkedin.com/rest/organizations/%s", orgID), headers, &org); err != nil {
			continue
		}
		targets = append(targets, discoveredTarget{
			ExternalAccountID:     orgID,
			DisplayName:           defaultString(org.Name, orgID),
			Username:              org.VanityName,
			TargetType:            "linkedin_organization",
			AccountClassification: "business",
			Scopes:                a.DefaultScopes(),
			Status:                targetStatusHealthy,
			Capabilities: map[string]any{
				"allowedSurfaces": []string{"text_post", "image_post", "multi_image", "video_post", "document_post"},
				"role":            acl.Role,
			},
			Metadata: map[string]any{
				"organizationURN": acl.Organization,
				"role":            acl.Role,
				"roleAssignee":    acl.RoleAssignee,
			},
		})
	}
	return targets, roleAssignee, nil
}

func (a *linkedInAdapter) uploadImage(ctx context.Context, headers map[string]string, owner string, asset assetBlob) (string, error) {
	initialize := map[string]any{
		"initializeUploadRequest": map[string]any{
			"owner": fmt.Sprintf("urn:li:organization:%s", owner),
		},
	}
	var resp struct {
		Value struct {
			UploadURL string `json:"uploadUrl"`
			Image     string `json:"image"`
		} `json:"value"`
	}
	if err := postJSON(ctx, "https://api.linkedin.com/rest/images?action=initializeUpload", initialize, headers, &resp); err != nil {
		return "", err
	}
	reader, err := asset.Open(ctx)
	if err != nil {
		return "", err
	}
	defer reader.Close()
	if err := putStream(ctx, resp.Value.UploadURL, asset.MIMEType, reader, nil); err != nil {
		return "", err
	}
	return resp.Value.Image, nil
}

func (a *linkedInAdapter) uploadVideo(ctx context.Context, headers map[string]string, owner string, asset assetBlob) (string, error) {
	initialize := map[string]any{
		"initializeUploadRequest": map[string]any{
			"owner": fmt.Sprintf("urn:li:organization:%s", owner),
		},
	}
	var resp struct {
		Value struct {
			UploadURL string `json:"uploadUrl"`
			Video     string `json:"video"`
		} `json:"value"`
	}
	if err := postJSON(ctx, "https://api.linkedin.com/rest/videos?action=initializeUpload", initialize, headers, &resp); err != nil {
		return "", err
	}
	reader, err := asset.Open(ctx)
	if err != nil {
		return "", err
	}
	defer reader.Close()
	if err := putStream(ctx, resp.Value.UploadURL, asset.MIMEType, reader, nil); err != nil {
		return "", err
	}
	return resp.Value.Video, nil
}

func (a *linkedInAdapter) uploadDocument(ctx context.Context, headers map[string]string, owner string, asset assetBlob) (string, error) {
	initialize := map[string]any{
		"initializeUploadRequest": map[string]any{
			"owner": fmt.Sprintf("urn:li:organization:%s", owner),
		},
	}
	var resp struct {
		Value struct {
			UploadURL string `json:"uploadUrl"`
			Document  string `json:"document"`
		} `json:"value"`
	}
	if err := postJSON(ctx, "https://api.linkedin.com/rest/documents?action=initializeUpload", initialize, headers, &resp); err != nil {
		return "", err
	}
	reader, err := asset.Open(ctx)
	if err != nil {
		return "", err
	}
	defer reader.Close()
	if err := putStream(ctx, resp.Value.UploadURL, asset.MIMEType, reader, nil); err != nil {
		return "", err
	}
	return resp.Value.Document, nil
}
