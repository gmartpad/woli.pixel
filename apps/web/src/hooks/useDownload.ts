import { useState } from "react";

/**
 * Wraps an async download action with loading state.
 * Use with downloadAuthFile/downloadBlobUrl to show spinners on buttons.
 */
export function useDownload() {
  const [downloading, setDownloading] = useState(false);

  async function trigger(fn: () => Promise<void> | void) {
    setDownloading(true);
    try {
      await fn();
    } finally {
      setDownloading(false);
    }
  }

  return { downloading, trigger } as const;
}
