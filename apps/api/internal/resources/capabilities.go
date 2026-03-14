package resources

type CapabilityRule struct {
	Platform              string   `json:"platform"`
	Surface               string   `json:"surface"`
	Label                 string   `json:"label"`
	Accepts               []string `json:"accepts"`
	HardLimit             []string `json:"hardLimit"`
	Preferred             []string `json:"preferred"`
	SupportedContentKinds []string `json:"supportedContentKinds"`
	AssetRequired         bool     `json:"assetRequired"`
	MinItems              *int     `json:"minItems,omitempty"`
	MaxItems              *int     `json:"maxItems,omitempty"`
}

type CapabilityMatrix struct {
	Rules []CapabilityRule `json:"rules"`
}

type ResourceCompatibility struct {
	Platform string   `json:"platform"`
	Surface  string   `json:"surface"`
	Status   string   `json:"status"`
	Reasons  []string `json:"reasons"`
}

func defaultCapabilityMatrix() CapabilityMatrix {
	min1 := 1
	min2 := 2
	max10 := 10
	max20 := 20
	max35 := 35
	return CapabilityMatrix{
		Rules: []CapabilityRule{
			{Platform: "instagram", Surface: "feed_photo", Label: "Instagram Feed Photo", Accepts: []string{"image"}, HardLimit: []string{"Width between 320px and 1080px", "Aspect ratio between 1.91:1 and 3:4"}, Preferred: []string{"JPG or PNG"}, SupportedContentKinds: []string{"text", "article"}, AssetRequired: true, MinItems: &min1},
			{Platform: "instagram", Surface: "carousel", Label: "Instagram Carousel", Accepts: []string{"image", "video"}, HardLimit: []string{"Up to 10 items"}, Preferred: []string{"Consistent aspect ratio across items"}, SupportedContentKinds: []string{"text", "article"}, AssetRequired: true, MinItems: &min2, MaxItems: &max10},
			{Platform: "instagram", Surface: "reel", Label: "Instagram Reel", Accepts: []string{"video"}, HardLimit: []string{"Min width 720px", "Aspect ratio between 1.91:1 and 9:16", "Minimum 30 FPS"}, Preferred: []string{"Vertical MP4"}, SupportedContentKinds: []string{"text"}, AssetRequired: true, MinItems: &min1},
			{Platform: "facebook", Surface: "feed_post", Label: "Facebook Feed Post", Accepts: []string{"image", "video"}, HardLimit: []string{"Text-only and media posts supported"}, Preferred: []string{"Add media when available for stronger reach"}, SupportedContentKinds: []string{"text", "article"}, AssetRequired: false},
			{Platform: "facebook", Surface: "feed_photo", Label: "Facebook Photo", Accepts: []string{"image"}, HardLimit: []string{"Recommended under 15 MB"}, Preferred: []string{"JPG or PNG"}, SupportedContentKinds: []string{"text", "article"}, AssetRequired: true, MinItems: &min1},
			{Platform: "facebook", Surface: "video", Label: "Facebook Video", Accepts: []string{"video"}, HardLimit: []string{"Up to 240 minutes", "Up to 4 GB"}, Preferred: []string{"MP4 or MOV"}, SupportedContentKinds: []string{"text"}, AssetRequired: true, MinItems: &min1},
			{Platform: "linkedin", Surface: "text_post", Label: "LinkedIn Text Post", Accepts: []string{"image", "video", "document"}, HardLimit: []string{"Organization text posts"}, Preferred: []string{"Use short commentary with a clear CTA"}, SupportedContentKinds: []string{"text", "article"}, AssetRequired: false},
			{Platform: "linkedin", Surface: "image_post", Label: "LinkedIn Image Post", Accepts: []string{"image"}, HardLimit: []string{"Up to 36,152,320 pixels total"}, Preferred: []string{"JPG, GIF, or PNG"}, SupportedContentKinds: []string{"text", "article"}, AssetRequired: true, MinItems: &min1},
			{Platform: "linkedin", Surface: "multi_image", Label: "LinkedIn Multi-Image Post", Accepts: []string{"image"}, HardLimit: []string{"2 to 20 images"}, Preferred: []string{"Consistent image sizing"}, SupportedContentKinds: []string{"text", "article"}, AssetRequired: true, MinItems: &min2, MaxItems: &max20},
			{Platform: "linkedin", Surface: "video_post", Label: "LinkedIn Video Post", Accepts: []string{"video"}, HardLimit: []string{"3 seconds to 30 minutes", "75 KB to 500 MB"}, Preferred: []string{"MP4"}, SupportedContentKinds: []string{"text"}, AssetRequired: true, MinItems: &min1},
			{Platform: "linkedin", Surface: "document_post", Label: "LinkedIn Document Post", Accepts: []string{"document"}, HardLimit: []string{"Up to 100 MB", "Up to 300 pages"}, Preferred: []string{"PDF, PPT, PPTX, DOC, DOCX"}, SupportedContentKinds: []string{"text", "article"}, AssetRequired: true, MinItems: &min1},
			{Platform: "x", Surface: "text_post", Label: "X Text Post", Accepts: []string{"image", "video"}, HardLimit: []string{"Text-first post"}, Preferred: []string{"Keep core message under 280 characters"}, SupportedContentKinds: []string{"text", "thread"}, AssetRequired: false},
			{Platform: "x", Surface: "thread_post", Label: "X Thread", Accepts: []string{"image", "video"}, HardLimit: []string{"Use thread content blocks"}, Preferred: []string{"Lead with the strongest first post"}, SupportedContentKinds: []string{"thread", "text"}, AssetRequired: false},
			{Platform: "x", Surface: "image_post", Label: "X Image Post", Accepts: []string{"image"}, HardLimit: []string{"Images up to 5 MB", "GIF up to 15 MB"}, Preferred: []string{"PNG or JPG"}, SupportedContentKinds: []string{"text", "thread"}, AssetRequired: true, MinItems: &min1},
			{Platform: "x", Surface: "video_post", Label: "X Video Post", Accepts: []string{"video"}, HardLimit: []string{"Video up to 1920x1200", "Aspect ratio between 1:2.39 and 2.39:1", "Up to 40 FPS"}, Preferred: []string{"MP4/H.264"}, SupportedContentKinds: []string{"text", "thread"}, AssetRequired: true, MinItems: &min1},
			{Platform: "tiktok", Surface: "video_post", Label: "TikTok Video Post", Accepts: []string{"video"}, HardLimit: []string{"Dimensions between 360px and 4096px", "23 to 60 FPS"}, Preferred: []string{"MP4, WebM, or MOV"}, SupportedContentKinds: []string{"text"}, AssetRequired: true, MinItems: &min1},
			{Platform: "tiktok", Surface: "photo_post", Label: "TikTok Photo Post", Accepts: []string{"image"}, HardLimit: []string{"Images up to 1080p", "Up to 20 MB each"}, Preferred: []string{"JPEG or WebP"}, SupportedContentKinds: []string{"text"}, AssetRequired: true, MinItems: &min1},
			{Platform: "tiktok", Surface: "carousel_ad", Label: "TikTok Carousel", Accepts: []string{"image"}, HardLimit: []string{"2 to 35 images"}, Preferred: []string{"JPG, JPEG, or PNG"}, SupportedContentKinds: []string{"text"}, AssetRequired: true, MinItems: &min2, MaxItems: &max35},
			{Platform: "youtube", Surface: "video", Label: "YouTube Video", Accepts: []string{"video"}, HardLimit: []string{"Up to 256 GB", "Up to 12 hours"}, Preferred: []string{"MP4/H.264/AAC"}, SupportedContentKinds: []string{"text"}, AssetRequired: true, MinItems: &min1},
			{Platform: "youtube", Surface: "short", Label: "YouTube Short", Accepts: []string{"video"}, HardLimit: []string{"Square or vertical", "Up to 3 minutes"}, Preferred: []string{"Vertical MP4/H.264/AAC"}, SupportedContentKinds: []string{"text"}, AssetRequired: true, MinItems: &min1},
		},
	}
}
