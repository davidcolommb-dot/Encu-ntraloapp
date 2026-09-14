export function getFormEmbedUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.hostname.includes("docs.google.com") && u.pathname.includes("/forms/")) {
      if (!u.searchParams.has("embedded")) u.searchParams.set("embedded", "true");
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}
