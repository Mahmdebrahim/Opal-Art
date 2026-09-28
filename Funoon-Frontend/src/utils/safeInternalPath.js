const APP_ORIGIN = "https://funoon.invalid";

export function safeInternalPath(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return null;
  }

  try {
    const url = new URL(value, APP_ORIGIN);
    if (url.origin !== APP_ORIGIN) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}