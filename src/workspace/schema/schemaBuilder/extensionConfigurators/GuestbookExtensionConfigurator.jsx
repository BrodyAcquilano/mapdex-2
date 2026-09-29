import { EXTENSION_LIMITS } from "../../../../../shared/validation/validationConstants.js";

export function GuestbookExtensionConfigurator({
  extension,
  setSchema,
  disabled,
}) {
  function normalizeGuestbook(nextExtension) {
    const enabled = nextExtension.enabled === true;

    return {
      ...nextExtension,
      enabled,
      perDataItemToggle: enabled ? !!nextExtension.perDataItemToggle : false,
    };
  }

  function update(field, value) {
    setSchema((prev) => {
      const current = prev.extensions.Guestbook || {};
      const nextExtension = normalizeGuestbook({
        ...current,
        [field]: value,
      });

      return {
        ...prev,
        extensions: {
          ...prev.extensions,
          Guestbook: nextExtension,
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
    </div>
  );
}