import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useHistoryFilters } from "./useHistoryFilters";

describe("useHistoryFilters", () => {
  beforeEach(() => {
    vi.stubGlobal("location", { search: "", pathname: "/" });
    vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
  });

  it("returns default filter values", () => {
    const { result } = renderHook(() => useHistoryFilters());

    expect(result.current.filters).toEqual({
      mode: "all",
      status: "all",
      categories: [],
      model: "",
      quality: "",
      search: "",
      datePreset: "all",
      dateFrom: "",
      dateTo: "",
    });
  });

  it("setFilter updates a single filter", () => {
    const { result } = renderHook(() => useHistoryFilters());

    act(() => {
      result.current.setFilter("mode", "generation");
    });

    expect(result.current.filters.mode).toBe("generation");
  });

  it("setFilter syncs to URL via replaceState", () => {
    const { result } = renderHook(() => useHistoryFilters());

    act(() => {
      result.current.setFilter("mode", "generation");
    });

    expect(window.history.replaceState).toHaveBeenCalled();
    const lastCall = vi.mocked(window.history.replaceState).mock.calls.at(-1);
    expect(lastCall?.[2]).toContain("mode=generation");
  });

  it("toggleCategory adds a category", () => {
    const { result } = renderHook(() => useHistoryFilters());

    act(() => {
      result.current.toggleCategory("admin");
    });

    expect(result.current.filters.categories).toEqual(["admin"]);
  });

  it("toggleCategory removes a category when toggled again", () => {
    const { result } = renderHook(() => useHistoryFilters());

    act(() => {
      result.current.toggleCategory("admin");
    });
    act(() => {
      result.current.toggleCategory("admin");
    });

    expect(result.current.filters.categories).toEqual([]);
  });

  it("toggleCategory supports multiple categories", () => {
    const { result } = renderHook(() => useHistoryFilters());

    act(() => {
      result.current.toggleCategory("admin");
    });
    act(() => {
      result.current.toggleCategory("content");
    });

    expect(result.current.filters.categories).toEqual(["admin", "content"]);
  });

  it("clearAll resets everything to defaults", () => {
    const { result } = renderHook(() => useHistoryFilters());

    act(() => {
      result.current.setFilter("mode", "generation");
      result.current.setFilter("status", "error");
      result.current.toggleCategory("admin");
      result.current.setFilter("search", "logo");
    });
    act(() => {
      result.current.clearAll();
    });

    expect(result.current.filters).toEqual({
      mode: "all",
      status: "all",
      categories: [],
      model: "",
      quality: "",
      search: "",
      datePreset: "all",
      dateFrom: "",
      dateTo: "",
    });
  });

  it("activeFilterCount tracks non-default count", () => {
    const { result } = renderHook(() => useHistoryFilters());

    expect(result.current.activeFilterCount).toBe(0);

    act(() => {
      result.current.setFilter("mode", "generation");
    });
    expect(result.current.activeFilterCount).toBe(1);

    act(() => {
      result.current.setFilter("status", "error");
    });
    expect(result.current.activeFilterCount).toBe(2);

    act(() => {
      result.current.toggleCategory("admin");
    });
    expect(result.current.activeFilterCount).toBe(3);
  });

  it("activeFilterCount decreases when filter reset to default", () => {
    const { result } = renderHook(() => useHistoryFilters());

    act(() => {
      result.current.setFilter("mode", "generation");
      result.current.setFilter("status", "error");
    });
    expect(result.current.activeFilterCount).toBe(2);

    act(() => {
      result.current.setFilter("mode", "all");
    });
    expect(result.current.activeFilterCount).toBe(1);
  });

  it("setDateRange sets custom range and clears datePreset to all", () => {
    const { result } = renderHook(() => useHistoryFilters());

    act(() => {
      result.current.setFilter("datePreset", "today");
    });
    expect(result.current.filters.datePreset).toBe("today");

    act(() => {
      result.current.setDateRange("2026-04-01", "2026-04-05");
    });

    expect(result.current.filters.dateFrom).toBe("2026-04-01");
    expect(result.current.filters.dateTo).toBe("2026-04-05");
    expect(result.current.filters.datePreset).toBe("all");
  });

  it("apiParams converts categories array to comma-separated string", () => {
    const { result } = renderHook(() => useHistoryFilters());

    act(() => {
      result.current.toggleCategory("admin");
      result.current.toggleCategory("content");
    });

    expect(result.current.apiParams.category).toBe("admin,content");
  });

  it("apiParams omits default/empty values", () => {
    const { result } = renderHook(() => useHistoryFilters());

    const params = result.current.apiParams;
    expect(params.mode).toBeUndefined();
    expect(params.status).toBeUndefined();
    expect(params.category).toBeUndefined();
    expect(params.model).toBeUndefined();
    expect(params.quality).toBeUndefined();
    expect(params.search).toBeUndefined();
    expect(params.datePreset).toBeUndefined();
    expect(params.dateFrom).toBeUndefined();
    expect(params.dateTo).toBeUndefined();
  });

  it("apiParams includes non-default values", () => {
    const { result } = renderHook(() => useHistoryFilters());

    act(() => {
      result.current.setFilter("mode", "generation");
      result.current.setFilter("status", "completed");
      result.current.setFilter("model", "recraft_v3");
      result.current.setFilter("quality", "high");
      result.current.setFilter("search", "logo");
      result.current.setFilter("datePreset", "today");
    });

    const params = result.current.apiParams;
    expect(params.mode).toBe("generation");
    expect(params.status).toBe("completed");
    expect(params.model).toBe("recraft_v3");
    expect(params.quality).toBe("high");
    expect(params.search).toBe("logo");
    expect(params.datePreset).toBe("today");
  });

  it("parses initial values from URL on mount", () => {
    vi.stubGlobal("location", {
      search: "?mode=upload&status=error&categories=admin,content&search=test",
      pathname: "/",
    });

    const { result } = renderHook(() => useHistoryFilters());

    expect(result.current.filters.mode).toBe("upload");
    expect(result.current.filters.status).toBe("error");
    expect(result.current.filters.categories).toEqual(["admin", "content"]);
    expect(result.current.filters.search).toBe(""); // search is not persisted to URL
  });

  it("URL sync omits default values", () => {
    const { result } = renderHook(() => useHistoryFilters());

    act(() => {
      result.current.setFilter("mode", "generation");
    });

    const lastCall = vi.mocked(window.history.replaceState).mock.calls.at(-1);
    const url = lastCall?.[2] as string;
    expect(url).toContain("mode=generation");
    expect(url).not.toContain("status=");
    expect(url).not.toContain("datePreset=");
  });
});
