/** Only same-origin paths survive; anything else (//evil, /\evil, https://…, javascript:) falls back. */
export const safeNextPath = (next: unknown, fallback = "/account") => {
  if (typeof next !== "string" || next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  try {
    const u = new URL(next, "http://x.invalid");
    return u.origin === "http://x.invalid" ? u.pathname + u.search + u.hash : fallback;
  } catch {
    return fallback;
  }
};
