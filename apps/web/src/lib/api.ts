const API_URL = import.meta.env.VITE_API_URL || "/api/v1";

function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: "include",
  });
}

// ── Profile / Avatar Endpoints ───────────────

export async function uploadAvatar(file: Blob): Promise<{ image_url: string }> {
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
  return res.json();
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
  overrides?: Record<string, string>
) {
  const res = await apiFetch(`${API_URL}/batches/${batchId}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ default_type_id: defaultTypeId, overrides }),
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
