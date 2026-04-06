// ── Types ────────────────────────────────────────────────────────

export type DatePreset = "today" | "yesterday" | "this_week" | "this_month" | "all";

export type DateRange = { from: Date | null; to: Date | null };

export type HistoryFilters = {
  page: number;
  perPage: number;
  mode: "all" | "generation" | "upload" | "crop";
  status: "all" | "completed" | "error";
  category?: string;
  model?: string;
  quality?: string;
  search?: string;
  datePreset?: DatePreset;
  dateFrom?: string;
  dateTo?: string;
};

export type HistoryItem = {
  id: string;
  mode: "generation" | "upload" | "crop";
  status: string;
  createdAt: string;
  thumbnailUrl: string;
  downloadUrl: string;
  category: string | null;
  imageTypeName: string | null;
  displayName: string | null;
  finalWidth: number | null;
  finalHeight: number | null;
  finalFormat: string | null;
  finalSizeKb: number | null;
  prompt: string | null;
  enhancedPrompt: string | null;
  model: string | null;
  qualityTier: string | null;
  costUsd: number | null;
  originalFilename: string | null;
  originalWidth: number | null;
  originalHeight: number | null;
  originalSizeKb: number | null;
  aiQualityScore: number | null;
};

export type HistoryResponse = {
  items: HistoryItem[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
};

// ── buildDateRange ───────────────────────────────────────────────

export function buildDateRange(preset: DatePreset): DateRange {
  if (preset === "all") {
    return { from: null, to: null };
  }

  const now = new Date();

  if (preset === "today") {
    const from = new Date(now);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(now);
    to.setUTCHours(23, 59, 59, 999);
    return { from, to };
  }

  if (preset === "yesterday") {
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - 1);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setUTCHours(23, 59, 59, 999);
    return { from, to };
  }

  if (preset === "this_week") {
    // Week starts Monday (1). Sunday = 0 in JS, treat as 7.
    const dayOfWeek = now.getUTCDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - daysSinceMonday);
    from.setUTCHours(0, 0, 0, 0);
    return { from, to: new Date(now) };
  }

  // this_month
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { from, to: new Date(now) };
}
