package social

import (
	"context"
	"io"
	"time"

	"github.com/google/uuid"

	"github.com/heimdall/api/internal/database"
	"github.com/heimdall/api/internal/iam"
	"github.com/heimdall/api/internal/posts"
)

type WorkspaceAuthorizer interface {
	RequireWorkspacePermission(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, requiredPermission string) ([]iam.APIPermission, error)
	ResolveWorkspaceID(principal *iam.Principal, requestedWorkspaceID string) (uuid.UUID, error)
}

type VariantReader interface {
	GetVariant(ctx context.Context, principal *iam.Principal, workspaceID, variantID uuid.UUID) (*posts.PostVariant, error)
}

type ProviderAvailability struct {
	Provider          string   `json:"provider"`
	Label             string   `json:"label"`
	ManagedAvailable  bool     `json:"managedAvailable"`
	SupportsBYOK      bool     `json:"supportsByok"`
	ConnectionModes   []string `json:"connectionModes"`
	ManagedStatus     string   `json:"managedStatus"`
	ManagedStatusText string   `json:"managedStatusText,omitempty"`
}

type AppCredentialRecord struct {
	ID               string         `json:"id"`
	WorkspaceID      string         `json:"workspaceId,omitempty"`
	Provider         string         `json:"provider"`
	Source           string         `json:"source"`
	Status           string         `json:"status"`
	ClientID         string         `json:"clientId"`
	ClientIDMasked   string         `json:"clientIdMasked"`
	ClientSecretHint string         `json:"clientSecretHint,omitempty"`
	Metadata         map[string]any `json:"metadata,omitempty"`
	CreatedAt        string         `json:"createdAt,omitempty"`
	UpdatedAt        string         `json:"updatedAt,omitempty"`
}

type TargetRecord struct {
	ID                    string         `json:"id"`
	ConnectionID          string         `json:"connectionId"`
	Provider              string         `json:"provider"`
	ExternalAccountID     string         `json:"externalAccountId"`
	ExternalParentID      string         `json:"externalParentId,omitempty"`
	DisplayName           string         `json:"displayName"`
	Username              string         `json:"username,omitempty"`
	TargetType            string         `json:"targetType"`
	AccountClassification string         `json:"accountClassification"`
	Status                string         `json:"status"`
	IsSelected            bool           `json:"isSelected"`
	ScopeSnapshot         []string       `json:"scopeSnapshot"`
	CapabilitySnapshot    map[string]any `json:"capabilitySnapshot"`
	Metadata              map[string]any `json:"metadata,omitempty"`
	LastValidatedAt       string         `json:"lastValidatedAt,omitempty"`
	LastValidationError   string         `json:"lastValidationError,omitempty"`
}

type ConnectionRecord struct {
	ID                   string         `json:"id"`
	Provider             string         `json:"provider"`
	CredentialSource     string         `json:"credentialSource"`
	Status               string         `json:"status"`
	HealthStatus         string         `json:"healthStatus"`
	AuthSubjectID        string         `json:"authSubjectId"`
	AuthSubjectName      string         `json:"authSubjectName"`
	Scopes               []string       `json:"scopes"`
	Metadata             map[string]any `json:"metadata,omitempty"`
	AccessTokenExpiresAt string         `json:"accessTokenExpiresAt,omitempty"`
	LastValidatedAt      string         `json:"lastValidatedAt,omitempty"`
	LastValidationError  string         `json:"lastValidationError,omitempty"`
	ConnectedAt          string         `json:"connectedAt"`
	CreatedAt            string         `json:"createdAt"`
	UpdatedAt            string         `json:"updatedAt"`
	Targets              []TargetRecord `json:"targets"`
}

type ConnectionsResponse struct {
	Connections []ConnectionRecord `json:"connections"`
	Targets     []TargetRecord     `json:"targets"`
}

type UpsertAppCredentialInput struct {
	ClientID     string         `json:"clientId"`
	ClientSecret string         `json:"clientSecret"`
	Metadata     map[string]any `json:"metadata"`
}

type StartOAuthInput struct {
	Provider         string `json:"provider"`
	CredentialSource string `json:"credentialSource"`
	ReturnOrigin     string `json:"returnOrigin"`
	ReturnPath       string `json:"returnPath"`
}

type StartOAuthResponse struct {
	AuthURL string `json:"authUrl"`
	State   string `json:"state"`
}

type ValidateTargetResult struct {
	Target               TargetRecord     `json:"target"`
	Connection           ConnectionRecord `json:"connection"`
	ValidationCheckpoint string           `json:"validationCheckpoint"`
}

type PublishabilityPreview struct {
	Ready               bool                   `json:"ready"`
	Provider            string                 `json:"provider"`
	Target              *TargetRecord          `json:"target,omitempty"`
	Issues              []posts.ReadinessIssue `json:"issues"`
	Warnings            []posts.ReadinessIssue `json:"warnings"`
	CapabilitySnapshot  map[string]any         `json:"capabilitySnapshot,omitempty"`
	PublicationMetadata map[string]any         `json:"publicationMetadata,omitempty"`
}

type PublishVariantInput struct {
	SocialTargetID *uuid.UUID
	Source         string
}

type SyncMetricsResult struct {
	PublicationID string             `json:"publicationId"`
	VariantID     string             `json:"variantId"`
	Metrics       map[string]float64 `json:"metrics"`
	SyncedAt      string             `json:"syncedAt"`
}

type providerCredential struct {
	ID           *uuid.UUID
	Provider     string
	Source       string
	ClientID     string
	ClientSecret string
	Metadata     map[string]any
}

type oauthState struct {
	database.SocialOAuthState
}

type providerSession struct {
	Connection   *database.SocialConnection
	Credential   providerCredential
	AccessToken  string
	RefreshToken string
	Scopes       []string
}

type discoveredTarget struct {
	ExternalAccountID     string
	ExternalParentID      string
	DisplayName           string
	Username              string
	TargetType            string
	AccountClassification string
	Scopes                []string
	Capabilities          map[string]any
	Metadata              map[string]any
	Status                string
}

type exchangeResult struct {
	AuthSubjectID        string
	AuthSubjectName      string
	AccessToken          string
	RefreshToken         string
	TokenType            string
	AccessTokenExpiresAt *time.Time
	Scopes               []string
	Metadata             map[string]any
	Targets              []discoveredTarget
}

type validateResult struct {
	Scopes       []string
	Capabilities map[string]any
	Status       string
	Error        string
}

type assetBlob struct {
	ResourceID   string
	DisplayName  string
	OriginalName string
	MediaKind    string
	MIMEType     string
	SizeBytes    int64
	PublicURL    string
	Open         func(context.Context) (io.ReadCloser, error)
}

type publishContent struct {
	VariantID   uuid.UUID
	ContentKind string
	Content     map[string]any
	Platform    string
	Surface     string
	Caption     string
	ThreadItems []string
	Title       string
	Body        string
}

type publishResult struct {
	ExternalPostID    string
	ExternalAccountID string
	PublishedAt       time.Time
	Metadata          map[string]any
}

type metricResult struct {
	Metrics  map[string]float64
	Metadata map[string]any
}

type providerAdapter interface {
	Provider() string
	Label() string
	DefaultScopes() []string
	SupportsBYOK() bool
	BuildAuthorizationURL(credential providerCredential, redirectURI string, state database.SocialOAuthState) (string, error)
	ExchangeCode(ctx context.Context, credential providerCredential, redirectURI string, state database.SocialOAuthState, code string) (*exchangeResult, error)
	RefreshConnection(ctx context.Context, session providerSession) (*exchangeResult, error)
	ValidateTargetCapabilities(ctx context.Context, session providerSession, target database.SocialTarget) (*validateResult, error)
	PublishPost(ctx context.Context, session providerSession, target database.SocialTarget, content publishContent, assets []assetBlob) (*publishResult, error)
	GetPostMetrics(ctx context.Context, session providerSession, target database.SocialTarget, publication database.PostVariantPublication) (*metricResult, error)
}
