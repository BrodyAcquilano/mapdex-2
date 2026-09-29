import { EXTENSION_LIMITS } from "../../../../../shared/validation/validationConstants.js";

export function GalleryExtensionConfigurator({
  extension,
  setSchema,
  disabled,
}) {
  function normalizeGallery(nextExtension, { finalize = false } = {}) {
    const enabled = nextExtension.enabled === true;
    let maxImages = nextExtension.maxImages;

    if (!enabled) {
      return {
        ...nextExtension,
        enabled: false,
        perDataItemToggle: false,
        maxImages: 0,
      };
    }

    if (
      maxImages === "" ||
      maxImages === null ||
      maxImages === undefined
    ) {
      return {
        ...nextExtension,
        enabled: true,
        perDataItemToggle: !!nextExtension.perDataItemToggle,
        maxImages: finalize
          ? EXTENSION_LIMITS.Gallery.maxImages.default
          : "",
      };
    }

    const numeric = Number(maxImages);

    if (!Number.isFinite(numeric)) {
      return {
        ...nextExtension,
        enabled: true,
        perDataItemToggle: !!nextExtension.perDataItemToggle,
        maxImages: finalize
          ? EXTENSION_LIMITS.Gallery.maxImages.default
          : "",
      };
    }

    return {
      ...nextExtension,
      enabled: true,
      perDataItemToggle: !!nextExtension.perDataItemToggle,
      maxImages: finalize
        ? Math.max(
            EXTENSION_LIMITS.Gallery.maxImages.min,
            Math.min(
              EXTENSION_LIMITS.Gallery.maxImages.max,
              numeric,
            ),
          )
        : maxImages,
    };
  }

  function update(field, value, options) {
    setSchema((prev) => {
      const current = prev.extensions.Gallery || {};

      const nextRaw =
        field === "enabled" && value === true
          ? {
              ...current,
              enabled: true,
              maxImages:
                current.maxImages === 0 ||
                current.maxImages === "" ||
                current.maxImages === null ||
                current.maxImages === undefined
                  ? EXTENSION_LIMITS.Gallery.maxImages.default
                  : current.maxImages,
            }
          : {
              ...current,
              [field]: value,
            };

      const nextExtension = normalizeGallery(nextRaw, options);

      return {
        ...prev,
        extensions: {
          ...prev.extensions,
          Gallery: nextExtension,
        },
      };
    });
  }

  return (
    <div
      className="input-configurator-group"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <label className="input-configurator-option">
        <input
          type="checkbox"
          checked={!!extension.enabled}
          disabled={disabled}
          onChange={(e) => update("enabled", e.target.checked)}
        />
        Enabled
      </label>

      <label className="input-configurator-option">
        <input
          type="checkbox"
          checked={!!extension.perDataItemToggle}
          disabled={disabled || !extension.enabled}
          onChange={(e) => update("perDataItemToggle", e.target.checked)}
        />
        Per-Data-Item Toggle
      </label>

      <label className="input-configurator-option">
        Max Images:
        <input
          type="number"
          min={EXTENSION_LIMITS.Gallery.maxImages.min}
          max={EXTENSION_LIMITS.Gallery.maxImages.max}
          value={extension.maxImages ?? ""}
          disabled={disabled || !extension.enabled}
          onChange={(e) => update("maxImages", e.target.value)}
          onBlur={(e) =>
            update("maxImages", e.target.value, { finalize: true })
          }
        />
      </label>
    </div>
  );
}