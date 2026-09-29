import { useEffect, useState } from "react";
import { renderBulletinText } from "./bulletinHelpers.jsx";
import {
  validateBulletinMessagePayload,
} from "../../shared/validation/bulletinContentValidation.js";
import "./bulletinMessage.css";

function BulletinMessageModal({
  isOpen,
  onClose,
  mode,
  message,
  maxMessageLength,
  maxTitleLength,
  messages,
  setMessages,
  schema,
  system,
  extensionsApi,
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isViewMode = mode === "view";
  const isAddMode = mode === "add";
  const isUpdateMode = mode === "update";

  useEffect(() => {
    if (!isOpen) return;

    if (isAddMode) {
      setTitle("");
      setBody("");
      return;
    }

    setTitle(message?.title || "");
    setBody(message?.body || "");
  }, [isOpen, isAddMode, message]);

  if (!isOpen) return null;

  const currentLength = body.length;
  const hasContent = title.trim() !== "" && body.trim() !== "";
  const canSubmit =
    !submitting &&
    hasContent &&
    title.length <= maxTitleLength &&
    currentLength <= maxMessageLength;

  async function handleSubmit() {
    if (!canSubmit || !schema?._id || !extensionsApi?.bulletin) return;

    const payload = {
      title: title.trim(),
      body: body.trim(),
    };

    const validation = validateBulletinMessagePayload(schema, payload);

    if (!validation.isValid) {
      system?.notify?.(validation.error || "Invalid bulletin message.");
      return;
    }

    setSubmitting(true);

    try {
      if (isAddMode) {
        const { data: apiResponse, message: apiMessage } =
          await extensionsApi.bulletin.add(schema._id, payload);

        if (apiMessage) {
          system?.notify?.(apiMessage);
        }

        if (apiResponse?.created && apiResponse?.messageId) {
          setMessages((prev) => [
            ...prev,
            {
              id: apiResponse.messageId,
              senderName: apiResponse.senderName || "Unknown",
              title: payload.title,
              body: payload.body,
              createdAt: apiResponse.createdAt || null,
              updatedAt: apiResponse.updatedAt || apiResponse.createdAt || null,
              userRole: "editor",
            },
          ]);

          onClose?.();
        }

        return;
      }

      if (isUpdateMode && message?.id) {
        const { data: apiResponse, message: apiMessage } =
          await extensionsApi.bulletin.update(schema._id, message.id, payload);

        if (apiMessage) {
          system?.notify?.(apiMessage);
        }

        if (apiResponse?.updated) {
          setMessages((prev) =>
            prev.map((msg) =>
              String(msg.id) === String(message.id)
                ? {
                    ...msg,
                    title: payload.title,
                    body: payload.body,
                    updatedAt: apiResponse.updatedAt || msg.updatedAt || null,
                  }
                : msg,
            ),
          );

          onClose?.();
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bulletin-message-modal-backdrop" onMouseDown={onClose}>
      <div
        className="bulletin-message-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="bulletin-message-close"
          onClick={onClose}
          aria-label="Close Bulletin Message"
        >
          ×
        </button>

        <div className="bulletin-message-board">
          <div className="bulletin-message-title-note">
            {isViewMode ? (
              <div className="bulletin-message-title-strip">
                {message?.title?.trim() || "Untitled Message"}
              </div>
            ) : (
              <input
                type="text"
                className="bulletin-message-title-input"
                value={title}
                maxLength={maxTitleLength}
                placeholder="Enter title..."
                onChange={(e) => setTitle(e.target.value)}
              />
            )}
          </div>

          <div className="bulletin-message-body-note">
            {isViewMode ? (
              <div className="bulletin-message-body-content">
                {renderBulletinText(
                  message?.body?.trim() || "No message content.",
                )}
              </div>
            ) : (
              <textarea
                className="bulletin-message-body-textarea"
                value={body}
                maxLength={maxMessageLength}
                placeholder="Write your message..."
                onChange={(e) => setBody(e.target.value)}
              />
            )}
          </div>
        </div>

        {!isViewMode && canSubmit && (
          <div className="bulletin-message-submit-row">
            <button
              type="button"
              className="form-add-button"
              onClick={handleSubmit}
            >
              {submitting
                ? "Submitting..."
                : isAddMode
                  ? "Submit Message"
                  : "Update Message"}
            </button>
          </div>
        )}

        {!!message?.senderName && (
          <div className="bulletin-message-meta-row">
            <div className="bulletin-message-posted-by">
              Posted by: {message.senderName}
            </div>
          </div>
        )}

        <div className="bulletin-message-footer">
          <div className="bulletin-message-length-label">
            {currentLength}/{maxMessageLength}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BulletinMessageModal;