import { useState, useMemo, useCallback } from "react";

import type { HistoryFilterParams } from "@/lib/api";

export type HistoryFilterState = {
  mode: string;
  status: string;
  categories: string[];
  model: string;
  quality: string;
  search: string;
  datePreset: string;
  dateFrom: string;
  dateTo: string;
};

const DEFAULTS: HistoryFilterState = {
  mode: "all",
  status: "all",
  categories: [],
  model: "",
  quality: "",
  search: "",
  datePreset: "all",
  dateFrom: "",
  dateTo: "",
};

function parseInitialFilters(): HistoryFilterState {
  const params = new URLSearchParams(window.location.search);
  return {
    mode: params.get("mode") || DEFAULTS.mode,
    status: params.get("status") || DEFAULTS.status,
    categories: params.get("categories")
      ? params.get("categories")!.split(",").filter(Boolean)
      : [],
    model: params.get("model") || DEFAULTS.model,
    quality: params.get("quality") || DEFAULTS.quality,
    search: DEFAULTS.search,
    datePreset: params.get("datePreset") || DEFAULTS.datePreset,
    dateFrom: params.get("dateFrom") || DEFAULTS.dateFrom,
    dateTo: params.get("dateTo") || DEFAULTS.dateTo,
  };
}

function syncToURL(filters: HistoryFilterState) {
  const params = new URLSearchParams();

  if (filters.mode !== DEFAULTS.mode) params.set("mode", filters.mode);
  if (filters.status !== DEFAULTS.status) params.set("status", filters.status);
  if (filters.categories.length > 0)
    params.set("categories", filters.categories.join(","));
  if (filters.model !== DEFAULTS.model) params.set("model", filters.model);
  if (filters.quality !== DEFAULTS.quality)
    params.set("quality", filters.quality);
  // search is intentionally NOT persisted to URL — clears on refresh/navigation
  if (filters.datePreset !== DEFAULTS.datePreset)
    params.set("datePreset", filters.datePreset);
  if (filters.dateFrom !== DEFAULTS.dateFrom)
    params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo !== DEFAULTS.dateTo) params.set("dateTo", filters.dateTo);

  const qs = params.toString();
  const url = qs
    ? `${window.location.pathname}?${qs}`
    : window.location.pathname;
  window.history.replaceState(null, "", url);
}

export function useHistoryFilters() {
  const [filters, setFilters] = useState<HistoryFilterState>(parseInitialFilters);

  const setFilter = useCallback(
    <K extends keyof HistoryFilterState>(key: K, value: HistoryFilterState[K]) => {
      setFilters((prev) => {
        const next = { ...prev, [key]: value };
        syncToURL(next);
        return next;
      });
    },
    [],
  );

  const toggleCategory = useCallback((cat: string) => {
    setFilters((prev) => {
      const exists = prev.categories.includes(cat);
      const next = {
        ...prev,
        categories: exists
          ? prev.categories.filter((c) => c !== cat)
          : [...prev.categories, cat],
      };
      syncToURL(next);
      return next;
    });
  }, []);

  const setDateRange = useCallback((from: string, to: string) => {
    setFilters((prev) => {
      const next = { ...prev, dateFrom: from, dateTo: to, datePreset: "all" };
      syncToURL(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    const next = { ...DEFAULTS };
    syncToURL(next);
    setFilters(next);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.mode !== DEFAULTS.mode) count++;
    if (filters.status !== DEFAULTS.status) count++;
    if (filters.categories.length > 0) count++;
    if (filters.model !== DEFAULTS.model) count++;
    if (filters.quality !== DEFAULTS.quality) count++;
    if (filters.search !== DEFAULTS.search) count++;
    if (filters.datePreset !== DEFAULTS.datePreset) count++;
    if (filters.dateFrom !== DEFAULTS.dateFrom) count++;
    if (filters.dateTo !== DEFAULTS.dateTo) count++;
    return count;
  }, [filters]);

  const apiParams = useMemo((): HistoryFilterParams => {
    const params: HistoryFilterParams = {};
    if (filters.mode !== DEFAULTS.mode) params.mode = filters.mode;
    if (filters.status !== DEFAULTS.status) params.status = filters.status;
    if (filters.categories.length > 0)
      params.category = filters.categories.join(",");
    if (filters.model !== DEFAULTS.model) params.model = filters.model;
    if (filters.quality !== DEFAULTS.quality) params.quality = filters.quality;
    if (filters.search !== DEFAULTS.search) params.search = filters.search;
    if (filters.datePreset !== DEFAULTS.datePreset)
      params.datePreset = filters.datePreset;
    if (filters.dateFrom !== DEFAULTS.dateFrom)
      params.dateFrom = filters.dateFrom;
    if (filters.dateTo !== DEFAULTS.dateTo) params.dateTo = filters.dateTo;
    return params;
  }, [filters]);

  return {
    filters,
    apiParams,
    setFilter,
    toggleCategory,
    setDateRange,
    clearAll,
    activeFilterCount,
  };
}
