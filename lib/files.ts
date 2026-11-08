// Shared by the browser, the app server and the chat agent, so nothing here
// may import server-only code

// Kept in the database, which the HTTP driver reads in one response
export const MAX_FILE_SIZE = 10 * 1024 * 1024

// Files in messages point here instead of at a web address, since the model
// needs the bytes and the browser needs the download route
export const FILE_URL_PREFIX = "arlo-file:"

export function toFileUrl(fileId: string) {
  return `${FILE_URL_PREFIX}${fileId}`
}

export function parseFileUrl(url: string) {
  return url.startsWith(FILE_URL_PREFIX)
    ? url.slice(FILE_URL_PREFIX.length)
    : null
}

// Where the browser shows or downloads a file
export function fileHref(fileId: string, { download = false } = {}) {
  return `/api/files/${encodeURIComponent(fileId)}${download ? "?download" : ""}`
}

// The common types by extension; anything else downloads as raw bytes
const MEDIA_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  rtf: "application/rtf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  json: "application/json",
  xml: "application/xml",
  yaml: "application/yaml",
  yml: "application/yaml",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "text/javascript",
  ts: "text/plain",
  py: "text/x-python",
  sh: "text/x-shellscript",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
  mov: "video/quicktime",
  zip: "application/zip",
  gz: "application/gzip",
  tar: "application/x-tar",
}

export function mediaTypeFor(name: string, fallback?: string) {
  const extension = name.split(".").pop()?.toLowerCase() ?? ""
  return MEDIA_TYPES[extension] ?? fallback ?? "application/octet-stream"
}

// A file name with no folders or control characters, safe as a sandbox path
// and in a download header
export function cleanFileName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? ""
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").trim()
  return clean && clean !== "." && clean !== ".." ? clean.slice(0, 200) : "file"
}

// Images the browser can show safely in a page; SVG can carry scripts
export function isPreviewableImage(mediaType: string) {
  return ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(
    mediaType
  )
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
