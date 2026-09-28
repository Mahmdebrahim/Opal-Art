const SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/i;
const HTTP_URL_PATTERN = /^https?:\/\//i;

export function safeExternalUrl(value) {
  if (typeof value !== "string") return null;

  const candidateValue = value.trim();
  if (!candidateValue || candidateValue.startsWith("@")) return null;

  const hasScheme = SCHEME_PATTERN.test(candidateValue);
  if (hasScheme && !HTTP_URL_PATTERN.test(candidateValue)) return null;

  const normalizedUrl = candidateValue.startsWith("//")
    ? `https:${candidateValue}`
    : hasScheme
      ? candidateValue
      : `https://${candidateValue}`;

  try {
    const url = new URL(normalizedUrl);
    if (!url.hostname || url.username || url.password) return null;
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}