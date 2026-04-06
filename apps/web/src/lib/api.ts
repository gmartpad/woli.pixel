const API_URL = import.meta.env.VITE_API_URL || "/api/v1";

function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: "include",
  });
}

// ── Profile / Avatar Endpoints ───────────────

export interface AvatarHistoryEntry {
  id: string;
  url: string;
  uploadedAt: string;
  fileSize: number;
}

export async function uploadAvatar(file: Blob): Promise<{ id: string; url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiFetch(`${API_URL}/profile/avatar`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao enviar foto");
  }
  const body = await res.json();
  return body.data;
}

export async function fetchAvatarHistory(): Promise<AvatarHistoryEntry[]> {
  const res = await apiFetch(`${API_URL}/profile/avatar/history`);
  if (!res.ok) throw new Error("Erro ao carregar histórico de fotos");
  const body = await res.json();
  return body.data;
}

export async function restoreAvatar(id: string): Promise<{ id: string; url: string }> {
  const res = await apiFetch(`${API_URL}/profile/avatar/${id}/restore`, {
    method: "PUT",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao restaurar foto");
  }
  const body = await res.json();
  return body.data;
}

export async function deleteAvatar(id: string): Promise<{ deleted: boolean; clearedCurrent: boolean }> {
  const res = await apiFetch(`${API_URL}/profile/avatar/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao excluir foto");
  }
  const body = await res.json();
  return body.data;
}

export async function bulkDeleteAvatars(ids: string[]): Promise<{ deleted: number; clearedCurrent: boolean }> {
  const res = await apiFetch(`${API_URL}/profile/avatar/bulk`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao excluir fotos");
  }
  const body = await res.json();
  return body.data;
}

// ── Existing Single-Image Endpoints ──────────

export async function uploadImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await apiFetch(`${API_URL}/images/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro no upload");
  }

  return res.json();
}

export async function fetchImageTypes() {
  const res = await apiFetch(`${API_URL}/image-types`);
  if (!res.ok) throw new Error("Erro ao carregar tipos");
  return res.json();
}

export async function processImage(
  uploadId: string,
  targetTypeId: string,
  crop?: { x: number; y: number; width: number; height: number }
) {
  const res = await apiFetch(`${API_URL}/images/${uploadId}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_type_id: targetTypeId, crop }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro no processamento");
  }

  return res.json();
}

// ── Batch Endpoints (Feature 1) ──────────────

export async function createBatch(name?: string) {
  const res = await apiFetch(`${API_URL}/batches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Erro ao criar lote");
  return res.json();
}

export async function uploadToBatch(batchId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiFetch(`${API_URL}/batches/${batchId}/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro no upload do lote");
  }
  return res.json();
}

export async function analyzeBatch(batchId: string) {
  const res = await apiFetch(`${API_URL}/batches/${batchId}/analyze`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro na análise do lote");
  }
  return res.json();
}

export async function processBatch(
  batchId: string,
  defaultTypeId?: string,
  overrides?: Record<string, string>,
  crops?: Record<string, { x: number; y: number; width: number; height: number }>
) {
  const res = await apiFetch(`${API_URL}/batches/${batchId}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      default_type_id: defaultTypeId,
      overrides,
      ...(crops && Object.keys(crops).length > 0 ? { crops } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro no processamento do lote");
  }
  return res.json();
}

export async function getBatch(batchId: string) {
  const res = await apiFetch(`${API_URL}/batches/${batchId}`);
  if (!res.ok) throw new Error("Erro ao carregar lote");
  return res.json();
}

// ── Brand Endpoints (Feature 2) ──────────────

export async function createBrand(data: {
  name: string;
  primary_color: string;
  secondary_color?: string;
  accent_color?: string;
  neutral_color?: string;
  forbidden_colors?: string[];
  tolerance?: number;
  notes?: string;
}) {
  const res = await apiFetch(`${API_URL}/brands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao criar marca");
  }
  return res.json();
}

export async function getBrands() {
  const res = await apiFetch(`${API_URL}/brands`);
  if (!res.ok) throw new Error("Erro ao carregar marcas");
  return res.json();
}

export async function updateBrand(id: string, data: Record<string, any>) {
  const res = await apiFetch(`${API_URL}/brands/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erro ao atualizar marca");
  return res.json();
}

export async function deleteBrand(id: string) {
  const res = await apiFetch(`${API_URL}/brands/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Erro ao excluir marca");
  return res.json();
}

export async function setDefaultBrand(id: string) {
  const res = await apiFetch(`${API_URL}/brands/${id}/set-default`, { method: "POST" });
  if (!res.ok) throw new Error("Erro ao definir marca padrão");
  return res.json();
}

export async function checkBrand(brandId: string, uploadId: string) {
  const res = await apiFetch(`${API_URL}/brands/${brandId}/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ upload_id: uploadId }),
  });
  if (!res.ok) throw new Error("Erro na verificação de marca");
  return res.json();
}

// ── Audit Endpoints (Feature 3) ──────────────

export async function createAudit(name: string, description?: string, passThreshold?: number) {
  const res = await apiFetch(`${API_URL}/audits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, pass_threshold: passThreshold }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao criar auditoria");
  }
  return res.json();
}

export async function uploadAuditImages(auditId: string, files: File[]) {
  const formData = new FormData();
  for (const file of files) formData.append("files", file);
  const res = await apiFetch(`${API_URL}/audits/${auditId}/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Erro no upload da auditoria");
  return res.json();
}

export async function addAuditUrls(auditId: string, urls: string[]) {
  const res = await apiFetch(`${API_URL}/audits/${auditId}/add-urls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls }),
  });
  if (!res.ok) throw new Error("Erro ao adicionar URLs");
  return res.json();
}

export async function startAuditScan(auditId: string) {
  const res = await apiFetch(`${API_URL}/audits/${auditId}/scan`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao iniciar escaneamento");
  }
  return res.json();
}

export async function getAudit(auditId: string) {
  const res = await apiFetch(`${API_URL}/audits/${auditId}`);
  if (!res.ok) throw new Error("Erro ao carregar auditoria");
  return res.json();
}

export async function getAuditReport(auditId: string) {
  const res = await apiFetch(`${API_URL}/audits/${auditId}/report`);
  if (!res.ok) throw new Error("Erro ao carregar relatório");
  return res.json();
}

export async function listAudits() {
  const res = await apiFetch(`${API_URL}/audits`);
  if (!res.ok) throw new Error("Erro ao listar auditorias");
  return res.json();
}

export async function deleteAudit(auditId: string) {
  const res = await apiFetch(`${API_URL}/audits/${auditId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Erro ao excluir auditoria");
  return res.json();
}

export async function exportAuditCsv(auditId: string): Promise<Blob> {
  const res = await apiFetch(`${API_URL}/audits/${auditId}/report/export`);
  if (!res.ok) throw new Error("Erro ao exportar CSV");
  return res.blob();
}

// ── Image Generation Endpoints ───────────────

export type ModerationResponse = {
  error: string;
  moderation: {
    flagged_reasons: string[];
    analysis: string;
    suggested_prompt: string;
  };
};

export class ModerationRejectedError extends Error {
  public readonly moderation: ModerationResponse["moderation"];

  constructor(data: ModerationResponse) {
    super(data.error);
    this.name = "ModerationRejectedError";
    this.moderation = data.moderation;
  }
}

export async function generateImage(
  imageTypeId: string,
  prompt: string,
  qualityTier: "low" | "medium" | "high" = "medium",
) {
  const res = await apiFetch(`${API_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_type_id: imageTypeId, prompt, quality_tier: qualityTier }),
  });
  if (!res.ok) {
    const err = await res.json();
    if (res.status === 422 && err.moderation) {
      throw new ModerationRejectedError(err);
    }
    throw new Error(err.error || "Erro na geração");
  }
  return res.json();
}

export async function getGenerationJob(id: string) {
  const res = await apiFetch(`${API_URL}/generate/${id}`);
  if (!res.ok) throw new Error("Erro ao carregar job de geração");
  return res.json();
}

export async function getGenerationHistory(page = 1) {
  const res = await apiFetch(`${API_URL}/generate/history?page=${page}`);
  if (!res.ok) throw new Error("Erro ao carregar histórico de geração");
  return res.json();
}

export async function getGenerationCostEstimate(typeKey: string) {
  const res = await apiFetch(`${API_URL}/generate/cost/${encodeURIComponent(typeKey)}`);
  if (!res.ok) throw new Error("Erro ao estimar custo");
  return res.json();
}

// ── Generation Cost Endpoints ────────────────

export async function fetchGenerationCosts() {
  const res = await apiFetch(`${API_URL}/generation-cost`);
  if (!res.ok) throw new Error("Erro ao carregar custos de geração");
  return res.json();
}

export async function fetchPresetCost(typeKey: string) {
  const res = await apiFetch(`${API_URL}/generation-cost/${encodeURIComponent(typeKey)}`);
  if (!res.ok) throw new Error("Erro ao carregar custo do preset");
  return res.json();
}

// ── Quality Gate Endpoints (Feature 4) ───────

export async function createGateConfig(data: Record<string, any>) {
  const res = await apiFetch(`${API_URL}/quality-gates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erro ao criar quality gate");
  return res.json();
}

export async function getGateConfigs() {
  const res = await apiFetch(`${API_URL}/quality-gates`);
  if (!res.ok) throw new Error("Erro ao carregar quality gates");
  return res.json();
}

export async function getGateConfig(id: string) {
  const res = await apiFetch(`${API_URL}/quality-gates/${id}`);
  if (!res.ok) throw new Error("Erro ao carregar quality gate");
  return res.json();
}

export async function updateGateConfig(id: string, data: Record<string, any>) {
  const res = await apiFetch(`${API_URL}/quality-gates/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erro ao atualizar quality gate");
  return res.json();
}

export async function deleteGateConfig(id: string) {
  const res = await apiFetch(`${API_URL}/quality-gates/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Erro ao excluir quality gate");
  return res.json();
}

export async function validateImageWithGate(gateId: string, file: File, source?: string) {
  const formData = new FormData();
  formData.append("file", file);
  if (source) formData.append("source", source);
  const res = await apiFetch(`${API_URL}/quality-gates/${gateId}/validate`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro na validação");
  }
  return res.json();
}

export async function getGateHistory(gateId: string, verdict?: string, page?: number) {
  const params = new URLSearchParams();
  if (verdict) params.set("verdict", verdict);
  if (page) params.set("page", String(page));
  const res = await apiFetch(`${API_URL}/quality-gates/${gateId}/history?${params}`);
  if (!res.ok) throw new Error("Erro ao carregar histórico");
  return res.json();
}

// ── Custom Presets Endpoints ────────────────

export type CustomPreset = {
  id: string;
  name: string;
  width: number;
  height: number;
  style: string;
  outputFormat: string;
  maxFileSizeKb: number;
  requiresTransparency: boolean;
  promptContext: string | null;
  createdAt: string;
};

export async function fetchCustomPresets(): Promise<CustomPreset[]> {
  const res = await apiFetch(`${API_URL}/custom-presets`);
  if (!res.ok) throw new Error("Erro ao carregar presets personalizados");
  const body = await res.json();
  return body.data;
}

export async function createCustomPreset(data: {
  name: string;
  width: number;
  height: number;
  style?: string;
  output_format?: string;
  max_file_size_kb?: number;
  requires_transparency?: boolean;
  prompt_context?: string;
}): Promise<CustomPreset> {
  const res = await apiFetch(`${API_URL}/custom-presets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao criar preset");
  }
  const body = await res.json();
  return body.data;
}

export async function updateCustomPreset(id: string, data: Record<string, any>): Promise<CustomPreset> {
  const res = await apiFetch(`${API_URL}/custom-presets/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao atualizar preset");
  }
  const body = await res.json();
  return body.data;
}

export async function deleteCustomPreset(id: string): Promise<void> {
  const res = await apiFetch(`${API_URL}/custom-presets/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Erro ao excluir preset");
}

export async function getCustomResolutionCostEstimate(
  width: number,
  height: number,
  style = "auto",
  transparency = false,
) {
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    style,
    transparency: String(transparency),
  });
  const res = await apiFetch(`${API_URL}/generate/cost/custom?${params}`);
  if (!res.ok) throw new Error("Erro ao estimar custo personalizado");
  return res.json();
}

export async function generateImageCustom(
  width: number,
  height: number,
  prompt: string,
  qualityTier: "low" | "medium" | "high" = "medium",
  style = "auto",
) {
  const res = await apiFetch(`${API_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      custom_width: width,
      custom_height: height,
      prompt,
      quality_tier: qualityTier,
      custom_style: style,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    if (res.status === 422 && err.moderation) {
      throw new ModerationRejectedError(err);
    }
    throw new Error(err.error || "Erro na geração");
  }
  return res.json();
}

export async function generateImageFromPreset(
  customPresetId: string,
  prompt: string,
  qualityTier: "low" | "medium" | "high" = "medium",
) {
  const res = await apiFetch(`${API_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      custom_preset_id: customPresetId,
      prompt,
      quality_tier: qualityTier,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    if (res.status === 422 && err.moderation) {
      throw new ModerationRejectedError(err);
    }
    throw new Error(err.error || "Erro na geração");
  }
  return res.json();
}

// ── History Endpoints ────────────────────────

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

export type HistoryFilterParams = {
  page?: number;
  perPage?: number;
  mode?: string;
  status?: string;
  category?: string;
  model?: string;
  quality?: string;
  search?: string;
  datePreset?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function fetchHistory(filters: HistoryFilterParams): Promise<HistoryResponse> {
  const params = new URLSearchParams();
  params.set("page", String(filters.page || 1));
  params.set("per_page", String(filters.perPage || 24));
  if (filters.mode && filters.mode !== "all") params.set("mode", filters.mode);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.category) params.set("category", filters.category);
  if (filters.model) params.set("model", filters.model);
  if (filters.quality) params.set("quality", filters.quality);
  if (filters.search) params.set("search", filters.search);
  if (filters.datePreset && filters.datePreset !== "all") params.set("date_preset", filters.datePreset);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);

  const res = await apiFetch(`${API_URL}/history?${params}`);
  if (!res.ok) throw new Error("Erro ao carregar histórico");
  return res.json();
}

export async function deleteHistoryItem(id: string, mode: string): Promise<void> {
  const res = await apiFetch(`${API_URL}/history/${id}?mode=${mode}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Erro ao excluir item");
}

export async function bulkDeleteHistory(
  items: { id: string; mode: string }[],
): Promise<void> {
  const res = await apiFetch(`${API_URL}/history/bulk`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error("Erro ao excluir itens");
}

export async function renameHistoryItem(
  id: string,
  mode: string,
  displayName: string | null,
): Promise<{ displayName: string | null }> {
  const res = await apiFetch(`${API_URL}/history/${id}/rename`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, displayName }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Erro ao renomear");
  return res.json();
}

// ── Crop Endpoints ─────────────────────────────

export async function saveCroppedImage(
  original: File,
  cropped: File,
  cropArea: { x: number; y: number; width: number; height: number },
): Promise<{ id: string; download_url: string }> {
  const formData = new FormData();
  formData.append("original", original);
  formData.append("cropped", cropped);
  formData.append("crop_x", String(Math.round(cropArea.x)));
  formData.append("crop_y", String(Math.round(cropArea.y)));
  formData.append("crop_w", String(Math.round(cropArea.width)));
  formData.append("crop_h", String(Math.round(cropArea.height)));

  const res = await apiFetch(`${API_URL}/crop`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao salvar recorte");
  }

  return res.json();
}

export async function downloadBatchZip(images: { id: string; format?: string }[]): Promise<Blob> {
  const res = await apiFetch(`${API_URL}/images/download-zip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images }),
  });
  if (!res.ok) throw new Error("Erro ao baixar imagens");
  return res.blob();
}

export async function bulkDownloadHistory(ids: string[]): Promise<Blob> {
  const res = await apiFetch(`${API_URL}/history/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error("Erro ao baixar imagens");
  return res.blob();
}
