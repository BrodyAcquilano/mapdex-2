// src/utils/GalleryHelpers.js

/**
 * Gallery image normalization helpers
 * -----------------------------------
 * These helpers decide HOW an image should be transformed:
 *  - how much to crop (minimally)
 *  - whether stretching is allowed
 *  - final resize targets
 *
 * Order of operations (important):
 *   1) Crop only what CANNOT be legally stretched
 *   2) Stretch (within tolerance) to target ratio
 *   3) Scale down to target pixel size
 *   4) Compress
 */

/* ───────── constants ───────── */

export const TARGET_RATIO = 3 / 2; // 1.5 (mini gallery: 3:2)
export const MAX_DISTORTION = 0.50; // ±35% stretch allowed

/* ───────── minimal crop math ───────── */

/**
 * Compute the MINIMAL centered crop needed so that
 * the remaining image can be stretched to TARGET_RATIO
 * without exceeding MAX_DISTORTION.
 *
 * If no crop is required, returns null.
 */
export function computeCropBoxMinimal({
  srcWidth,
  srcHeight,
  targetRatio = TARGET_RATIO,
  maxDistortion = MAX_DISTORTION,
}) {
  const R = srcWidth / srcHeight;

  // Allowed ratio band after stretch
  const T_max = targetRatio * (1 + maxDistortion);
  const T_min = targetRatio / (1 + maxDistortion);

  // ── Too wide (banner / wide landscape) → crop WIDTH
  if (R > T_max) {
    const targetWidth = Math.round(srcHeight * T_max);
    const cropX = srcWidth - targetWidth;

    return {
      left: Math.floor(cropX / 2),
      top: 0,
      width: targetWidth,
      height: srcHeight,
    };
  }

  // ── Too tall (portrait) → crop HEIGHT
  if (R < T_min) {
    const targetHeight = Math.round(srcWidth / T_min);
    const cropY = srcHeight - targetHeight;

    return {
      left: 0,
      top: Math.floor(cropY / 2),
      width: srcWidth,
      height: targetHeight,
    };
  }

  // ── Within tolerance → no crop
  return null;
}

/* ───────── resize targets ───────── */

/**
 * Compute final pixel dimensions for a given max width
 * while enforcing TARGET_RATIO.
 */
export function computeTargetSize({
  maxWidth,
  ratio = TARGET_RATIO,
}) {
  const width = maxWidth;
  const height = Math.round(width / ratio);
  return { width, height };
}

/* ───────── sharp plan builder ───────── */

/**
 * Build a transformation plan for sharp:
 *  - minimal crop (if needed)
 *  - resize to target dimensions
 *  - stretch always allowed AFTER crop
 */
export function buildSharpTransformPlan({
  srcWidth,
  srcHeight,
  targetMaxWidth,
}) {
  const crop = computeCropBoxMinimal({
    srcWidth,
    srcHeight,
  });

  const resize = computeTargetSize({
    maxWidth: targetMaxWidth,
  });

  return {
    crop,      // null or { left, top, width, height }
    resize,    // { width, height }
    stretch: true, // stretch to target ratio AFTER crop
  };
}
