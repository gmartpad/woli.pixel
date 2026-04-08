import { getAuthToken } from "@/lib/auth-client";

/**
 * Triggers a browser download from an existing blob URL.
 *
 * Use this when the image has already been fetched (e.g. by useAuthImage)
 * and can be reused without a second network request. Blob URLs are
 * same-origin, so the `download` attribute works correctly.
 */
export function downloadBlobUrl(blobUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Downloads a file from an authenticated endpoint using the Bearer token.
 *
 * Handles S3 redirect responses: the backend may return a 302 redirect to a
 * pre-signed S3 URL. If we follow the redirect with the Authorization header,
 * S3 rejects the CORS preflight (403). We use `redirect: "manual"` to intercept
 * the redirect, then fetch the S3 URL without auth headers (the pre-signed URL
 * already embeds S3 auth via query params). If the redirect Location is opaque,
 * we fall back to proxying through the backend via `?inline=1`.
 */
export async function downloadAuthFile(
  url: string,
  filename: string,
): Promise<void> {
  const token = getAuthToken();
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // First attempt: intercept redirects to avoid sending auth headers to S3
  const res = await fetch(url, { headers, credentials: "include", redirect: "manual" });

  let blob: Blob;

  if (res.type === "opaqueredirect" || res.status === 0) {
    // Opaque redirect — browser hides the Location header.
    // Retry through the backend proxy to avoid S3 CORS entirely.
    const separator = url.includes("?") ? "&" : "?";
    const proxyRes = await fetch(`${url}${separator}inline=1`, { headers, credentials: "include" });
    if (!proxyRes.ok) throw new Error(`Download failed: ${proxyRes.status}`);
    blob = await proxyRes.blob();
  } else if (res.status >= 300 && res.status < 400) {
    // Explicit redirect with visible Location — fetch S3 URL without auth
    const location = res.headers.get("Location");
    if (!location) throw new Error("Redirect without Location header");
    const s3Res = await fetch(location);
    if (!s3Res.ok) throw new Error(`Download failed: ${s3Res.status}`);
    blob = await s3Res.blob();
  } else if (res.ok) {
    // No redirect — backend returned the file directly
    blob = await res.blob();
  } else {
    throw new Error(`Download failed: ${res.status}`);
  }

  const blobUrl = URL.createObjectURL(blob);
  downloadBlobUrl(blobUrl, filename);
  URL.revokeObjectURL(blobUrl);
}
