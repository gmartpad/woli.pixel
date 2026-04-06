import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { buildDateRange } from "./history-query";
import type { DatePreset, DateRange, HistoryItem, HistoryResponse, HistoryFilters } from "./history-query";

// ── buildDateRange ──────────────────────────────────────────────

describe("buildDateRange", () => {
  let realDate: typeof Date;
  let fixedNow: Date;

  beforeEach(() => {
    // Fix "now" to Wednesday 2026-04-01 14:30:00 UTC
    fixedNow = new Date("2026-04-01T14:30:00.000Z");
    realDate = globalThis.Date;
    globalThis.Date = class extends realDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(fixedNow.getTime());
        } else {
          // @ts-ignore
          super(...args);
        }
      }
      static now() {
        return fixedNow.getTime();
      }
    } as any;
  });

  afterEach(() => {
    globalThis.Date = realDate;
  });

  test('"all" returns null from and null to', () => {
    const range = buildDateRange("all");
    expect(range.from).toBeNull();
    expect(range.to).toBeNull();
  });

  test('"today" returns midnight today to end of today', () => {
    const range = buildDateRange("today");
    expect(range.from).not.toBeNull();
    expect(range.to).not.toBeNull();

    // from = 2026-04-01 00:00:00.000 UTC
    expect(range.from!.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    // to = 2026-04-01 23:59:59.999 UTC
    expect(range.to!.toISOString()).toBe("2026-04-01T23:59:59.999Z");
  });

  test('"yesterday" returns midnight yesterday to end of yesterday', () => {
    const range = buildDateRange("yesterday");
    expect(range.from).not.toBeNull();
    expect(range.to).not.toBeNull();

    // from = 2026-03-31 00:00:00.000 UTC
    expect(range.from!.toISOString()).toBe("2026-03-31T00:00:00.000Z");
    // to = 2026-03-31 23:59:59.999 UTC
    expect(range.to!.toISOString()).toBe("2026-03-31T23:59:59.999Z");
  });

  test('"this_week" returns Monday midnight to now (week starts Monday)', () => {
    // 2026-04-01 is a Wednesday, so Monday = 2026-03-30
    const range = buildDateRange("this_week");
    expect(range.from).not.toBeNull();
    expect(range.to).not.toBeNull();

    // from = Monday 2026-03-30 00:00:00.000 UTC
    expect(range.from!.toISOString()).toBe("2026-03-30T00:00:00.000Z");
    // to = now
    expect(range.to!.toISOString()).toBe("2026-04-01T14:30:00.000Z");
  });

  test('"this_month" returns 1st of current month to now', () => {
    const range = buildDateRange("this_month");
    expect(range.from).not.toBeNull();
    expect(range.to).not.toBeNull();

    // from = 2026-04-01 00:00:00.000 UTC
    expect(range.from!.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    // to = now
    expect(range.to!.toISOString()).toBe("2026-04-01T14:30:00.000Z");
  });

  test('"this_week" when today is Monday returns Monday midnight to now', () => {
    // Override to Monday 2026-03-30 10:00:00 UTC
    const mondayNow = new Date("2026-03-30T10:00:00.000Z");
    globalThis.Date = class extends realDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(mondayNow.getTime());
        } else {
          // @ts-ignore
          super(...args);
        }
      }
      static now() {
        return mondayNow.getTime();
      }
    } as any;

    const range = buildDateRange("this_week");
    expect(range.from!.toISOString()).toBe("2026-03-30T00:00:00.000Z");
    expect(range.to!.toISOString()).toBe("2026-03-30T10:00:00.000Z");
  });

  test('"this_week" when today is Sunday returns previous Monday', () => {
    // Override to Sunday 2026-04-05 18:00:00 UTC
    const sundayNow = new Date("2026-04-05T18:00:00.000Z");
    globalThis.Date = class extends realDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(sundayNow.getTime());
        } else {
          // @ts-ignore
          super(...args);
        }
      }
      static now() {
        return sundayNow.getTime();
      }
    } as any;

    const range = buildDateRange("this_week");
    // Sunday April 5 -> Monday March 30
    expect(range.from!.toISOString()).toBe("2026-03-30T00:00:00.000Z");
    expect(range.to!.toISOString()).toBe("2026-04-05T18:00:00.000Z");
  });
});

// ── Type exports smoke-check ────────────────────────────────────

describe("type exports", () => {
  test("DatePreset, DateRange, HistoryItem, HistoryResponse, HistoryFilters are importable", () => {
    // Compile-time check — if this file compiles, the types exist
    const preset: DatePreset = "today";
    const range: DateRange = { from: null, to: null };
    const item: HistoryItem = {
      id: "1",
      mode: "generation",
      status: "completed",
      createdAt: "2026-04-01T00:00:00Z",
      thumbnailUrl: "",
      downloadUrl: "",
      category: null,
      imageTypeName: null,
      finalWidth: null,
      finalHeight: null,
      finalFormat: null,
      finalSizeKb: null,
      prompt: null,
      enhancedPrompt: null,
      model: null,
      qualityTier: null,
      costUsd: null,
      originalFilename: null,
      originalWidth: null,
      originalHeight: null,
      originalSizeKb: null,
      aiQualityScore: null,
    };
    const response: HistoryResponse = {
      items: [item],
      total: 1,
      page: 1,
      perPage: 24,
      hasMore: false,
    };
    const filters: HistoryFilters = {
      page: 1,
      perPage: 24,
      mode: "all",
      status: "all",
    };

    expect(preset).toBe("today");
    expect(range.from).toBeNull();
    expect(response.items).toHaveLength(1);
    expect(filters.page).toBe(1);
  });
});
