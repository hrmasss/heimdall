const MAX_CLIENT_UPLOAD_BYTES = 1024 * 1024 * 512;
const documentExtensions = new Set([".pdf", ".doc", ".docx", ".ppt", ".pptx"]);

export { MAX_CLIENT_UPLOAD_BYTES };

export function getFileExtension(name: string) {
	return name.slice(name.lastIndexOf(".")).toLowerCase();
}

export function isSupportedResourceFile(file: File) {
	if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
		return true;
	}
	return documentExtensions.has(getFileExtension(file.name));
}
