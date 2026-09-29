import { EXTENSION_LIMITS } from "../../../../../shared/validation/validationConstants.js";

export function ChatConfigurator({
  extension,
  setSchema,
  disabled,
}) {
  function normalizeChat(nextExtension, { finalize = false } = {}) {
    const enabled = nextExtension.enabled === true;
    let maxMessages = nextExtension.maxMessages;
    let messageLength = nextExtension.messageLength;

    if (!enabled) {
      return {
        ...nextExtension,
        enabled: false,
        maxMessages: 0,
        messageLength: 0,
      };
    }

    if (
      maxMessages === "" ||
      maxMessages === null ||
      maxMessages === undefined
    ) {
      maxMessages = finalize
        ? EXTENSION_LIMITS.Chat.maxMessages.default
        : "";
    } else {
      const numeric = Number(maxMessages);
      maxMessages = Number.isFinite(numeric)
        ? finalize
          ? Math.max(
              EXTENSION_LIMITS.Chat.maxMessages.min,
              Math.min(
                EXTENSION_LIMITS.Chat.maxMessages.max,
                numeric,
              ),
            )
          : maxMessages
        : finalize
          ? EXTENSION_LIMITS.Chat.maxMessages.default
          : "";
    }

    if (
      messageLength === "" ||
      messageLength === null ||
      messageLength === undefined
    ) {
      messageLength = finalize
        ? EXTENSION_LIMITS.Chat.messageLength.default
        : "";
    } else {
      const numeric = Number(messageLength);
      messageLength = Number.isFinite(numeric)
        ? finalize
          ? Math.max(
              EXTENSION_LIMITS.Chat.messageLength.min,
              Math.min(
                EXTENSION_LIMITS.Chat.messageLength.max,
                numeric,
              ),
            )
          : messageLength
        : finalize
          ? EXTENSION_LIMITS.Chat.messageLength.default
          : "";
    }

    return {
      ...nextExtension,
      enabled: true,
      maxMessages,
      messageLength,
    };
  }

  function update(field, value, options) {
    setSchema((prev) => {
      const current = prev.extensions.Chat || {};

      const nextRaw =
        field === "enabled" && value === true
          ? {
              ...current,
              enabled: true,
              maxMessages:
                current.maxMessages === 0 ||
                current.maxMessages === "" ||
                current.maxMessages === null ||
                current.maxMessages === undefined
                  ? EXTENSION_LIMITS.Chat.maxMessages.default
                  : current.maxMessages,
              messageLength:
                current.messageLength === 0 ||
                current.messageLength === "" ||
                current.messageLength === null ||
                current.messageLength === undefined
                  ? EXTENSION_LIMITS.Chat.messageLength.default
                  : current.messageLength,
            }
          : {
              ...current,
              [field]: value,
            };

      const nextExtension = normalizeChat(nextRaw, options);

      return {
        ...prev,
        extensions: {
          ...prev.extensions,
          Chat: nextExtension,
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
        Max Messages:
        <input
          type="number"
          min={EXTENSION_LIMITS.Chat.maxMessages.min}
          max={EXTENSION_LIMITS.Chat.maxMessages.max}
          value={extension.maxMessages ?? ""}
          disabled={disabled || !extension.enabled}
          onChange={(e) => update("maxMessages", e.target.value)}
          onBlur={(e) =>
            update("maxMessages", e.target.value, { finalize: true })
          }
        />
      </label>

      <label className="input-configurator-option">
        Message Length:
        <input
          type="number"
          min={EXTENSION_LIMITS.Chat.messageLength.min}
          max={EXTENSION_LIMITS.Chat.messageLength.max}
          value={extension.messageLength ?? ""}
          disabled={disabled || !extension.enabled}
          onChange={(e) => update("messageLength", e.target.value)}
          onBlur={(e) =>
            update("messageLength", e.target.value, { finalize: true })
          }
        />
      </label>
    </div>
  );
}