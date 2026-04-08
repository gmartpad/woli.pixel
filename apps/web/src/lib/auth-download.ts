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
 * The HTML `<a download>` attribute is ignored for cross-origin URLs,
 * so we fetch the file via JS with the Bearer token and trigger a
 * programmatic download using a temporary blob URL.
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

  const res = await fetch(url, { headers, credentials: "include" });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  downloadBlobUrl(blobUrl, filename);
  URL.revokeObjectURL(blobUrl);
}
