import { useState, useEffect, useRef } from "react";
import { getAuthToken } from "@/lib/auth-client";

/**
 * Fetches an authenticated image via Bearer token and returns a blob URL.
 *
 * Browser `<img>` tags cannot set custom HTTP headers, so cross-origin
 * authenticated endpoints fail when third-party cookies are blocked
 * (Safari ITP, Chrome SameSite policies). This hook fetches the image
 * via JS with the Bearer token and exposes a same-origin blob URL.
 */
export function useAuthImage(url: string | null): {
  src: string | null;
  loading: boolean;
} {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // Revoke previous blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    if (!url) {
      setSrc(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const token = getAuthToken();
    const headers = new Headers();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    // Append inline=1 so download endpoints stream instead of redirecting
    // to S3 (which would fail CORS preflight from fetch())
    const fetchUrl = new URL(url, window.location.origin);
    fetchUrl.searchParams.set("inline", "1");

    fetch(fetchUrl.toString(), { headers, credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (!cancelled) {
          const objectUrl = URL.createObjectURL(blob);
          blobUrlRef.current = objectUrl;
          setSrc(objectUrl);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  // Revoke on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  return { src, loading };
}
