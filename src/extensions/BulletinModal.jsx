import { useEffect, useRef, useState } from "react";
import "../styles/modals.css";
import "./bulletin.css";
import BulletinMessageModal from "./BulletinMessageModal.jsx";
import { getBulletinConfig } from "../../shared/validation/bulletinContentValidation.js";

function BulletinModal({
  isOpen,
  onClose,
  mode,
  schema,
  system,
  extensionsApi,
}) {
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [selectedMessageId, setSelectedMessageId] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeMessageModal, setActiveMessageModal] = useState(null);

  const bulletinConfig = getBulletinConfig(schema);
  const maxMessages = bulletinConfig.maxMessages;
  const maxMessageLength = bulletinConfig.messageLength;
  const maxTitleLength = bulletinConfig.titleLength;
  const isEditor = mode === "editor";

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement;
    closeButtonRef.current?.focus();

    const cleanup = system.trapFocus(modalRef.current, onClose);

    return () => {
      cleanup?.();
      previousFocus?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !extensionsApi?.bulletin?.getAll || !schema?._id) {
      return;
    }

    const fetchMessages = async () => {
      setLoading(true);

      const { data: apiResponse, message } =
        await extensionsApi.bulletin.getAll(schema._id);

      if (message) {
        system?.notify?.(message);
      }

      const nextMessages = Array.isArray(apiResponse?.messages)
        ? apiResponse.messages
        : [];

      setMessages(nextMessages);

      setSelectedMessageId((prev) => {
        if (!prev) return nextMessages[0]?.id || "";
        const stillExists = nextMessages.some((msg) => msg.id === prev);
        return stillExists ? prev : nextMessages[0]?.id || "";
      });

      setLoading(false);
    };

    fetchMessages();
  }, [isOpen]);

  const selectedMessage =
    messages.find((msg) => msg.id === selectedMessageId) || null;

  const atMaxMessages = messages.length >= maxMessages;
  const hasMessages = messages.length > 0;

  function canEditMessage(messageToCheck) {
    if (!messageToCheck) return false;
    return messageToCheck.userRole === "editor";
  }

  function handleOpenSelected() {
    if (!selectedMessage) {
      system?.notify?.("Select a message to open.");
      return;
    }

    setActiveMessageModal({
      mode: "view",
      message: selectedMessage,
    });
  }

  function handleAddMessage() {
    setActiveMessageModal({
      mode: "add",
      message: null,
    });
  }

  function handleUpdateSelected() {
    if (!selectedMessage) {
      system?.notify?.("Select a message to update.");
      return;
    }

    if (!canEditMessage(selectedMessage)) {
      system?.notify?.(
        "You do not have permission to edit other people's messages.",
      );
      return;
    }

    setActiveMessageModal({
      mode: "update",
      message: selectedMessage,
    });
  }

  async function handleDeleteSelected(messageId = selectedMessageId) {
    if (!messageId) {
      system?.notify?.("Select a message to delete.");
      return;
    }

    if (!extensionsApi?.bulletin?.remove || !schema?._id) {
      return;
    }

    const messageToDelete =
      messages.find((msg) => msg.id === messageId) || null;

    if (!canEditMessage(messageToDelete)) {
      system?.notify?.(
        "You do not have permission to edit other people's messages.",
      );
      return;
    }

    const confirmed = await system.confirm({
      message: `Delete "${messageToDelete?.title || "Untitled"}"?`,
      confirmText: "Delete",
      cancelText: "Cancel",
    });

    if (!confirmed) return;

    const { data: apiResponse, message } = await extensionsApi.bulletin.remove(
      schema._id,
      messageId,
    );

    if (message) {
      system?.notify?.(message);
    }

    if (!apiResponse?.deleted) return;

    const removedMessageId = apiResponse.messageId || messageId;
    const nextMessages = messages.filter(
      (msg) => String(msg.id) !== String(removedMessageId),
    );

    setMessages(nextMessages);

    setSelectedMessageId((prev) => {
      if (String(prev) !== String(removedMessageId)) return prev;
      return nextMessages[0]?.id || "";
    });
  }

  if (!isOpen) return null;

  return (
    <>
      <div
        className={`modal-backdrop ${isOpen ? "open" : "hidden"}`}
        aria-hidden={!isOpen}
        onMouseDown={onClose}
      >
        <div
          ref={modalRef}
          className="modal-overlay centered-modal-overlay bulletin-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulletin-modal-title"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            className="modal bulletin-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              ref={closeButtonRef}
              className="close-button"
              onClick={onClose}
              aria-label="Close Bulletin Board"
            >
              ×
            </button>

            <h3 id="bulletin-modal-title">Bulletin Board</h3>

            <div className="bulletin-section-divider" aria-hidden="true" />

            <div className="bulletin-note">Select a message to open it.</div>

            <div className="bulletin-board-block">
              <div className="bulletin-board-section">
                <h4>Messages</h4>

                <div
                  className="bulletin-message-list"
                  role="listbox"
                  aria-label="Bulletin Messages"
                >
                  {loading ? (
                    <div className="bulletin-empty-message">
                      Loading messages...
                    </div>
                  ) : hasMessages ? (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`bulletin-message-item ${
                          String(selectedMessageId) === String(msg.id)
                            ? "bulletin-message-item-selected"
                            : ""
                        }`}
                        onClick={() => setSelectedMessageId(msg.id)}
                      >
                        <div className="bulletin-message-title-row">
                          <span className="bulletin-message-title">
                            {msg.title?.trim() || "Untitled"}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="bulletin-empty-message">
                      No bulletin messages yet.
                    </div>
                  )}
                </div>
              </div>

              {selectedMessage?.senderName && (
                <div className="bulletin-note bulletin-selected-note">
                  <strong>Posted by:</strong> {selectedMessage.senderName}
                </div>
              )}

              {hasMessages && (
                <div className="buttons-container-two bulletin-buttons-row">
                  <button
                    type="button"
                    className="form-add-button"
                    onClick={handleOpenSelected}
                  >
                    Open Selected
                  </button>

                  {isEditor && (
                    <button
                      type="button"
                      className="form-delete-button"
                      onClick={() => handleDeleteSelected()}
                    >
                      Delete Selected
                    </button>
                  )}
                </div>
              )}

              {isEditor && (
                <div className="buttons-container-two bulletin-buttons-row">
                  {hasMessages && (
                    <button
                      type="button"
                      className="form-add-button"
                      onClick={handleUpdateSelected}
                    >
                      Update Selected
                    </button>
                  )}

                  {!atMaxMessages ? (
                    <button
                      type="button"
                      className="form-add-button"
                      onClick={handleAddMessage}
                    >
                      Add Message
                    </button>
                  ) : (
                    <button type="button" className="form-add-button" disabled>
                      At Max Messages
                    </button>
                  )}
                </div>
              )}

              <div className="bulletin-message-count">
                {messages.length}/{maxMessages} messages
              </div>
            </div>
          </div>
        </div>
      </div>

      <BulletinMessageModal
        isOpen={!!activeMessageModal}
        onClose={() => setActiveMessageModal(null)}
        mode={activeMessageModal?.mode || "view"}
        message={activeMessageModal?.message || null}
        maxMessageLength={maxMessageLength}
        maxTitleLength={maxTitleLength}
        messages={messages}
        setMessages={setMessages}
        schema={schema}
        system={system}
        extensionsApi={extensionsApi}
      />
    </>
  );
}

export default BulletinModal;