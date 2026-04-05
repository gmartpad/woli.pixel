import type { BrandConsistencyResult } from "./color-analysis";

export type GateConfig = {
  minQualityScore: number;
  maxFileSizeKb: number | null;
  requireNoBlur: boolean;
  requireNoLowResolution: boolean;
  requireMinWidth: number | null;
  requireMinHeight: number | null;
  allowedContentTypes: string[] | null;
  blockedContentTypes: string[] | null;
};

export type AnalysisInput = {
  quality: {
    score: number;
    blur_detected: boolean;
    low_resolution: boolean;
  };
  content: {
    type: string;
  };
};

export type ImageMeta = {
  width: number;
  height: number;
  sizeKb: number;
};

export type GateCheckDetail = {
  required: number | boolean | string | string[] | null;
  actual: number | boolean | string;
  passed: boolean;
};

export type GateEvaluation = {
  verdict: "pass" | "fail" | "warn";
  quality_score: number;
  failures: string[];
  warnings: string[];
  details: {
    score_check: GateCheckDetail;
    blur_check: GateCheckDetail;
    resolution_check: GateCheckDetail;
    dimension_check?: GateCheckDetail;
    content_type_check?: GateCheckDetail;
    file_size_check?: GateCheckDetail;
    brand_check?: GateCheckDetail;
  };
};

export function evaluateGate(
  config: GateConfig,
  analysis: AnalysisInput,
  imageMeta: ImageMeta,
  brandResult?: BrandConsistencyResult
): GateEvaluation {
  const failures: string[] = [];
  const warnings: string[] = [];
  const details: GateEvaluation["details"] = {
    score_check: { required: config.minQualityScore, actual: analysis.quality.score, passed: true },
    blur_check: { required: config.requireNoBlur, actual: analysis.quality.blur_detected, passed: true },
    resolution_check: { required: config.requireNoLowResolution, actual: analysis.quality.low_resolution, passed: true },
  };

  // 1. Quality score check
  if (analysis.quality.score < config.minQualityScore) {
    details.score_check.passed = false;
    failures.push(`Score de qualidade ${analysis.quality.score} está abaixo do mínimo ${config.minQualityScore}`);
  }

  // 2. Blur check
  if (config.requireNoBlur && analysis.quality.blur_detected) {
    details.blur_check.passed = false;
    failures.push("Imagem com desfoque (blur) detectado");
  }

  // 3. Resolution check
  if (config.requireNoLowResolution && analysis.quality.low_resolution) {
    details.resolution_check.passed = false;
    failures.push("Resolução insuficiente detectada");
  }

  // 4. Dimension check
  if (config.requireMinWidth || config.requireMinHeight) {
    const wOk = !config.requireMinWidth || imageMeta.width >= config.requireMinWidth;
    const hOk = !config.requireMinHeight || imageMeta.height >= config.requireMinHeight;
    const passed = wOk && hOk;
    details.dimension_check = {
      required: `${config.requireMinWidth || "any"}×${config.requireMinHeight || "any"}`,
      actual: `${imageMeta.width}×${imageMeta.height}`,
      passed,
    };
    if (!passed) {
      failures.push(
        `Dimensões ${imageMeta.width}×${imageMeta.height}px abaixo do mínimo ${config.requireMinWidth || "?"}×${config.requireMinHeight || "?"}px`
      );
    }
  }

  // 5. Content type whitelist
  if (config.allowedContentTypes && config.allowedContentTypes.length > 0) {
    const passed = config.allowedContentTypes.includes(analysis.content.type);
    details.content_type_check = {
      required: config.allowedContentTypes,
      actual: analysis.content.type,
      passed,
    };
    if (!passed) {
      failures.push(
        `Tipo de conteúdo "${analysis.content.type}" não está na lista permitida: ${config.allowedContentTypes.join(", ")}`
      );
    }
  }

  // 6. Content type blacklist
  if (config.blockedContentTypes && config.blockedContentTypes.length > 0) {
    const isBlocked = config.blockedContentTypes.includes(analysis.content.type);
    if (!details.content_type_check) {
      details.content_type_check = {
        required: config.blockedContentTypes,
        actual: analysis.content.type,
        passed: !isBlocked,
      };
    } else if (isBlocked) {
      details.content_type_check.passed = false;
    }
    if (isBlocked) {
      failures.push(
        `Tipo de conteúdo "${analysis.content.type}" está na lista bloqueada`
      );
    }
  }

  // 7. File size check
  if (config.maxFileSizeKb) {
    const passed = imageMeta.sizeKb <= config.maxFileSizeKb;
    details.file_size_check = {
      required: config.maxFileSizeKb,
      actual: imageMeta.sizeKb,
      passed,
    };
    if (!passed) {
      failures.push(
        `Tamanho ${imageMeta.sizeKb}KB excede o máximo de ${config.maxFileSizeKb}KB`
      );
    }
  }

  // 8. Brand check (warning only, not failure)
  if (brandResult) {
    const brandThreshold = 60;
    const passed = brandResult.score >= brandThreshold;
    details.brand_check = {
      required: brandThreshold,
      actual: brandResult.score,
      passed,
    };
    if (!passed) {
      warnings.push(
        `Score de marca ${brandResult.score} está abaixo do limiar ${brandThreshold}`
      );
    }
  }

  // Determine verdict
  let verdict: "pass" | "fail" | "warn";
  if (failures.length > 0) {
    verdict = "fail";
  } else if (warnings.length > 0) {
    verdict = "warn";
  } else {
    verdict = "pass";
  }

  return {
    verdict,
    quality_score: analysis.quality.score,
    failures,
    warnings,
    details,
  };
}
