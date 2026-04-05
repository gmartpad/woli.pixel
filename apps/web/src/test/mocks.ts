export const MOCK_IMAGE_TYPES_RESPONSE = {
  types: [
    { id: "t1", category: "admin", typeKey: "logo_topo", displayName: "Logo Topo (Header)", width: null, height: null, aspectRatio: "variable", maxFileSizeKb: 500, allowedFormats: ["png", "jpeg"], services: ["LMS Web"] },
    { id: "t2", category: "admin", typeKey: "favicon", displayName: "Favicon", width: 128, height: 128, aspectRatio: "1:1", maxFileSizeKb: 500, allowedFormats: ["png"], services: ["LMS Web"] },
    { id: "t3", category: "content", typeKey: "conteudo_imagem", displayName: "Imagem de Conteúdo", width: 1920, height: 1080, aspectRatio: "16:9", maxFileSizeKb: 10240, allowedFormats: ["png", "jpeg", "gif"], services: ["LMS Web", "App Mobile"] },
    { id: "t4", category: "gamification", typeKey: "badge_conquista", displayName: "Badge de Conquista", width: 128, height: 128, aspectRatio: "1:1", maxFileSizeKb: 500, allowedFormats: ["png"], services: ["LMS Web", "App Mobile"] },
  ],
  grouped: {
    admin: [
      { id: "t1", category: "admin", typeKey: "logo_topo", displayName: "Logo Topo (Header)", width: null, height: null, aspectRatio: "variable", maxFileSizeKb: 500, allowedFormats: ["png", "jpeg"], services: ["LMS Web"] },
      { id: "t2", category: "admin", typeKey: "favicon", displayName: "Favicon", width: 128, height: 128, aspectRatio: "1:1", maxFileSizeKb: 500, allowedFormats: ["png"], services: ["LMS Web"] },
    ],
    content: [
      { id: "t3", category: "content", typeKey: "conteudo_imagem", displayName: "Imagem de Conteúdo", width: 1920, height: 1080, aspectRatio: "16:9", maxFileSizeKb: 10240, allowedFormats: ["png", "jpeg", "gif"], services: ["LMS Web", "App Mobile"] },
    ],
    gamification: [
      { id: "t4", category: "gamification", typeKey: "badge_conquista", displayName: "Badge de Conquista", width: 128, height: 128, aspectRatio: "1:1", maxFileSizeKb: 500, allowedFormats: ["png"], services: ["LMS Web", "App Mobile"] },
    ],
  },
  total: 4,
};

export const MOCK_UPLOAD_RESPONSE = {
  id: "upload-1",
  filename: "test.png",
  format: "png",
  width: 800,
  height: 600,
  sizeKb: 150,
  status: "uploaded",
  metadata: {
    density: 72,
    space: "srgb",
    channels: 3,
    depth: "uchar",
    hasAlpha: false,
    hasProfile: false,
    isProgressive: false,
    orientation: null,
  },
};

export const MOCK_ANALYSIS_RESPONSE = {
  quality: { score: 8, issues: [], blur_detected: false, low_resolution: false, poor_contrast: false },
  content: { type: "photo", primary_subject: "Paisagem", has_text: false, has_transparency: false, dominant_colors: ["#2563eb", "#16a34a", "#f5f5f5"] },
  suggested_type: { image_type_id: "t3", type_key: "conteudo_imagem", display_name: "Imagem de Conteúdo", confidence: 85, reasoning: "Fotografia adequada para conteúdo." },
  crop_suggestion: { subject_center_x: 0.5, subject_center_y: 0.5, recommended_crop: { x1: 0, y1: 0, x2: 1, y2: 1 } },
};

export const MOCK_COST_RESPONSE = {
  model: "gpt-image-1-mini",
  qualityLabels: {
    low: { label: "Rascunho", description: "Pré-visualização rápida, prototipagem, placeholders" },
    medium: { label: "Padrão", description: "Uso geral, bom equilíbrio qualidade/custo" },
    high: { label: "Alta Qualidade", description: "Ativos finais, imagens de produção" },
  },
  presets: [
    { typeKey: "favicon", displayName: "Favicon", targetWidth: 128, targetHeight: 128, openaiSize: "1024x1024", costs: { low: 0.005, medium: 0.011, high: 0.036 }, notes: null },
    { typeKey: "conteudo_imagem", displayName: "Imagem de Conteúdo", targetWidth: 1920, targetHeight: 1080, openaiSize: "1536x1024", costs: { low: 0.006, medium: 0.015, high: 0.052 }, notes: "Sharp upscale ~25% — qualidade \"alta\" recomendada" },
  ],
  totals: { low: 0.011, medium: 0.026, high: 0.088 },
  squareCount: 1,
  nonSquareCount: 1,
  notes: {
    pricing: "Custos de saída apenas.",
    batch: "Batch API reduz todos os preços pela metade.",
    upscaling: "Presets acima de 1024px geram em 1536x1024.",
    downscaling: "Presets pequenos geram em 1024x1024.",
  },
};
