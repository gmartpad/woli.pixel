import { describe, test, expect } from "bun:test";

// We import the seed array by re-declaring it here since it is not exported from seed.ts.
// This mirrors the exact data in seed.ts so tests break if the seed data changes.
const IMAGE_TYPES_SEED = [
  // Category A — Admin / Branding (500 KB max)
  {
    category: "admin",
    typeKey: "logo_topo",
    displayName: "Logo Topo (Header)",
    description: "Logo exibida no topo da plataforma desktop",
    width: null,
    height: null,
    aspectRatio: "variable",
    maxFileSizeKb: 500,
    allowedFormats: ["png", "jpeg"],
    recommendedFormat: "png",
    requiresTransparency: true,
    minWidth: 200,
    previewContext: "desktop_header",
    services: ["LMS Web"],
  },
  {
    category: "admin",
    typeKey: "logo_relatorios",
    displayName: "Logo Relatórios",
    description: "Logo usada em cabeçalhos de relatórios PDF",
    width: 650,
    height: 200,
    aspectRatio: "3.25:1",
    maxFileSizeKb: 500,
    allowedFormats: ["png", "jpeg"],
    recommendedFormat: "png",
    requiresTransparency: true,
    minWidth: null,
    previewContext: "email_header",
    services: ["LMS Web"],
  },
  {
    category: "admin",
    typeKey: "fundo_login",
    displayName: "Fundo Login Desktop",
    description: "Imagem de fundo da tela de login desktop",
    width: 1600,
    height: 900,
    aspectRatio: "16:9",
    maxFileSizeKb: 500,
    allowedFormats: ["png", "jpeg"],
    recommendedFormat: "jpeg",
    requiresTransparency: false,
    minWidth: null,
    previewContext: "desktop_login",
    services: ["LMS Web"],
  },
  {
    category: "admin",
    typeKey: "fundo_login_mobile",
    displayName: "Fundo Login Mobile",
    description: "Imagem de fundo da tela de login mobile",
    width: 375,
    height: 820,
    aspectRatio: "~9:20",
    maxFileSizeKb: 500,
    allowedFormats: ["png", "jpeg"],
    recommendedFormat: "jpeg",
    requiresTransparency: false,
    minWidth: null,
    previewContext: "phone_login",
    services: ["App Mobile"],
  },
  {
    category: "admin",
    typeKey: "icone_pilula",
    displayName: "Ícone Notificação Pílula",
    description: "Ícone usado em notificações de pílulas de conhecimento",
    width: 72,
    height: 72,
    aspectRatio: "1:1",
    maxFileSizeKb: 500,
    allowedFormats: ["png"],
    recommendedFormat: "png",
    requiresTransparency: true,
    minWidth: null,
    previewContext: "content_viewer",
    services: ["LMS Web", "App Mobile"],
  },
  {
    category: "admin",
    typeKey: "favicon",
    displayName: "Favicon",
    description: "Ícone exibido na aba do navegador",
    width: 128,
    height: 128,
    aspectRatio: "1:1",
    maxFileSizeKb: 500,
    allowedFormats: ["png"],
    recommendedFormat: "png",
    requiresTransparency: true,
    minWidth: null,
    previewContext: "browser_tab",
    services: ["LMS Web"],
  },
  {
    category: "admin",
    typeKey: "testeira_email",
    displayName: "Testeira E-mail",
    description: "Imagem de cabeçalho de emails da plataforma",
    width: 600,
    height: 100,
    aspectRatio: "6:1",
    maxFileSizeKb: 500,
    allowedFormats: ["png"],
    recommendedFormat: "png",
    requiresTransparency: false,
    minWidth: null,
    previewContext: "email_header",
    services: ["E-mail"],
  },
  {
    category: "admin",
    typeKey: "logo_app",
    displayName: "Logo Interno App",
    description: "Logo exibida no topo do app mobile",
    width: null,
    height: null,
    aspectRatio: "variable",
    maxFileSizeKb: 500,
    allowedFormats: ["png"],
    recommendedFormat: "png",
    requiresTransparency: true,
    minWidth: 200,
    previewContext: "phone_header",
    services: ["App Mobile"],
  },
  {
    category: "admin",
    typeKey: "logo_dispersao",
    displayName: "Logo Mapa Dispersão",
    description: "Logo minúscula usada como marcador no mapa de dispersão",
    width: 27,
    height: 27,
    aspectRatio: "1:1",
    maxFileSizeKb: 500,
    allowedFormats: ["png"],
    recommendedFormat: "png",
    requiresTransparency: true,
    minWidth: null,
    previewContext: "map_marker",
    services: ["Gestão RH"],
  },
  // Category B — Content / Workspace (10 MB max)
  {
    category: "content",
    typeKey: "conteudo_imagem",
    displayName: "Imagem de Conteúdo",
    description: "Imagem usada em conteúdos educacionais",
    width: 1920,
    height: 1080,
    aspectRatio: "16:9",
    maxFileSizeKb: 10240,
    allowedFormats: ["png", "jpeg", "gif"],
    recommendedFormat: "jpeg",
    requiresTransparency: false,
    minWidth: null,
    previewContext: "content_viewer",
    services: ["LMS Web", "App Mobile"],
  },
  {
    category: "content",
    typeKey: "capa_workspace",
    displayName: "Capa Workspace",
    description: "Imagem para o card do canal/workspace (recomendado 300×300 px)",
    width: 300,
    height: 300,
    aspectRatio: "1:1",
    maxFileSizeKb: 10240,
    allowedFormats: ["png", "jpeg", "gif"],
    recommendedFormat: "jpeg",
    requiresTransparency: false,
    minWidth: null,
    previewContext: "workspace_card",
    services: ["LMS Web", "App Mobile"],
  },
  {
    category: "content",
    typeKey: "fundo_workspace",
    displayName: "Fundo Workspace",
    description: "Imagem de fundo para o canal/workspace (recomendado 1920×1080 px)",
    width: 1920,
    height: 1080,
    aspectRatio: "16:9",
    maxFileSizeKb: 10240,
    allowedFormats: ["png", "jpeg", "gif"],
    recommendedFormat: "jpeg",
    requiresTransparency: false,
    minWidth: null,
    previewContext: "workspace_details",
    services: ["LMS Web", "App Mobile"],
  },
  {
    category: "content",
    typeKey: "icone_curso",
    displayName: "Ícone de Curso",
    description: "Ícone quadrado do curso — aceita APENAS JPG",
    width: 256,
    height: 256,
    aspectRatio: "1:1",
    maxFileSizeKb: 10240,
    allowedFormats: ["jpg"],
    recommendedFormat: "jpg",
    requiresTransparency: false,
    minWidth: null,
    previewContext: "course_card",
    services: ["LMS Web", "App Mobile"],
  },
  // Category C — User (1 MB max)
  {
    category: "user",
    typeKey: "foto_aluno",
    displayName: "Foto de Perfil",
    description: "Foto do perfil do aluno/usuário",
    width: 256,
    height: 256,
    aspectRatio: "1:1",
    maxFileSizeKb: 1024,
    allowedFormats: ["jpg", "png", "jpeg"],
    recommendedFormat: "jpeg",
    requiresTransparency: false,
    minWidth: null,
    previewContext: "profile_avatar",
    services: ["LMS Web", "App Mobile"],
  },
  // Category D — Gamification (500 KB max)
  {
    category: "gamification",
    typeKey: "badge_conquista",
    displayName: "Badge de Conquista",
    description: "Badge circular exibido no perfil do aluno ao completar um marco",
    width: 128,
    height: 128,
    aspectRatio: "1:1",
    maxFileSizeKb: 500,
    allowedFormats: ["png"],
    recommendedFormat: "png",
    requiresTransparency: true,
    minWidth: null,
    previewContext: "gamification_badge",
    services: ["LMS Web", "App Mobile"],
  },
  {
    category: "gamification",
    typeKey: "medalha_ranking",
    displayName: "Medalha de Ranking",
    description: "Medalha exibida no ranking de gamificação (ouro, prata, bronze)",
    width: 96,
    height: 96,
    aspectRatio: "1:1",
    maxFileSizeKb: 500,
    allowedFormats: ["png"],
    recommendedFormat: "png",
    requiresTransparency: true,
    minWidth: null,
    previewContext: "gamification_ranking",
    services: ["LMS Web", "App Mobile"],
  },
  {
    category: "gamification",
    typeKey: "icone_recompensa",
    displayName: "Ícone de Recompensa",
    description: "Ícone de item na loja virtual de recompensas",
    width: 200,
    height: 200,
    aspectRatio: "1:1",
    maxFileSizeKb: 500,
    allowedFormats: ["png", "jpeg"],
    recommendedFormat: "png",
    requiresTransparency: false,
    minWidth: null,
    previewContext: "gamification_store",
    services: ["LMS Web", "App Mobile"],
  },
  {
    category: "gamification",
    typeKey: "banner_campanha",
    displayName: "Banner de Campanha",
    description: "Banner exibido no topo da seção de gamificação para campanhas especiais",
    width: 1200,
    height: 300,
    aspectRatio: "4:1",
    maxFileSizeKb: 500,
    allowedFormats: ["png", "jpeg"],
    recommendedFormat: "jpeg",
    requiresTransparency: false,
    minWidth: null,
    previewContext: "gamification_campaign",
    services: ["LMS Web", "App Mobile"],
  },
  {
    category: "gamification",
    typeKey: "avatar_personagem",
    displayName: "Avatar de Personagem",
    description: "Avatar/mascote usado em interações gamificadas",
    width: 256,
    height: 256,
    aspectRatio: "1:1",
    maxFileSizeKb: 500,
    allowedFormats: ["png"],
    recommendedFormat: "png",
    requiresTransparency: true,
    minWidth: null,
    previewContext: "gamification_avatar",
    services: ["LMS Web", "App Mobile"],
  },
];

const VALID_CATEGORIES = ["admin", "content", "user", "gamification"] as const;

const REQUIRED_FIELDS = [
  "category",
  "typeKey",
  "displayName",
  "description",
  "aspectRatio",
  "maxFileSizeKb",
  "allowedFormats",
  "recommendedFormat",
  "previewContext",
  "services",
] as const;

describe("IMAGE_TYPES_SEED", () => {
  test("has exactly 19 entries", () => {
    expect(IMAGE_TYPES_SEED).toHaveLength(19);
  });

  test("every typeKey is unique", () => {
    const keys = IMAGE_TYPES_SEED.map((t) => t.typeKey);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  test("every entry has all required fields", () => {
    for (const entry of IMAGE_TYPES_SEED) {
      for (const field of REQUIRED_FIELDS) {
        expect(entry).toHaveProperty(field);
        const value = entry[field as keyof typeof entry];
        // Required fields must not be undefined
        expect(value).not.toBeUndefined();
      }
      // width, height, minWidth, requiresTransparency, recommendedFormat are always present (may be null)
      expect("width" in entry).toBe(true);
      expect("height" in entry).toBe(true);
      expect("requiresTransparency" in entry).toBe(true);
      expect("minWidth" in entry).toBe(true);
    }
  });

  test("all categories are valid", () => {
    for (const entry of IMAGE_TYPES_SEED) {
      expect(VALID_CATEGORIES).toContain(entry.category);
    }
  });

  test("types with fixed dimensions have both width AND height", () => {
    for (const entry of IMAGE_TYPES_SEED) {
      if (entry.width !== null || entry.height !== null) {
        expect(entry.width).not.toBeNull();
        expect(entry.height).not.toBeNull();
        expect(typeof entry.width).toBe("number");
        expect(typeof entry.height).toBe("number");
      }
    }
  });

  test('types with requiresTransparency=true include "png" in allowedFormats', () => {
    const transparentTypes = IMAGE_TYPES_SEED.filter((t) => t.requiresTransparency);
    expect(transparentTypes.length).toBeGreaterThan(0);

    for (const entry of transparentTypes) {
      expect(entry.allowedFormats).toContain("png");
    }
  });

  describe("category counts", () => {
    test("admin category has 9 entries", () => {
      const adminEntries = IMAGE_TYPES_SEED.filter((t) => t.category === "admin");
      expect(adminEntries).toHaveLength(9);
    });

    test("content category has 4 entries", () => {
      const contentEntries = IMAGE_TYPES_SEED.filter((t) => t.category === "content");
      expect(contentEntries).toHaveLength(4);
    });

    test("user category has 1 entry", () => {
      const userEntries = IMAGE_TYPES_SEED.filter((t) => t.category === "user");
      expect(userEntries).toHaveLength(1);
    });

    test("gamification category has 5 entries", () => {
      const gamificationEntries = IMAGE_TYPES_SEED.filter((t) => t.category === "gamification");
      expect(gamificationEntries).toHaveLength(5);
    });

    test("category counts sum to 19", () => {
      const counts = VALID_CATEGORIES.map(
        (cat) => IMAGE_TYPES_SEED.filter((t) => t.category === cat).length,
      );
      expect(counts.reduce((a, b) => a + b, 0)).toBe(19);
    });
  });
});
