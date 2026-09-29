import { useEffect, useRef, useState } from "react";
import "./chat.css";
import {
  getProjectChatConfig,
  validateProjectChatMessagePayload,
} from "../../shared/validation/projectChatContentValidation.js";

function ChatPanel({
  isOpen,
  onClose,
  mode,
  schema,
  system,
  extensionsApi,
  isMobile,
}) {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const panelRef = useRef(null);
  const chatWindowRef = useRef(null);
  const chatEndRef = useRef(null);
  const isAtBottomRef = useRef(true);

  const dragStateRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  const [panelPosition, setPanelPosition] = useState({
    x: 24,
    y: 24,
  });

  const chatConfig = getProjectChatConfig(schema);
const maxMessages = chatConfig.maxMessages;
const messageLength = chatConfig.messageLength;

  useEffect(() => {
    if (isMobile) return;

    const width = 420;
    const height = 520;
    const desiredTop = 100;

    const maxX = Math.max(8, window.innerWidth - width - 8);
    const maxY = Math.max(8, window.innerHeight - height - 8);

    const desiredRightX = (window.innerWidth - width) / 2;

    setPanelPosition({
      x: Math.min(Math.max(8, desiredRightX), maxX),
      y: Math.min(desiredTop, maxY),
    });
  }, [isMobile]);

  useEffect(() => {
    if (!isOpen || !schema?._id || !extensionsApi?.projectChat?.getAll) return;

    let isCancelled = false;

    const fetchMessages = async ({ silent = false } = {}) => {
      const { data: apiResponse, message: apiMessage } =
        await extensionsApi.projectChat.getAll(schema._id);

      if (!isCancelled) {
        if (apiMessage && !silent) {
          system?.notify?.(apiMessage);
        }

        setMessages(
          Array.isArray(apiResponse?.messages) ? apiResponse.messages : [],
        );
        setLoading(false);
      }
    };

    setLoading(true);
    fetchMessages();

    const intervalId = setInterval(() => {
      fetchMessages({ silent: true });
    }, 5000);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isAtBottomRef.current && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  function handleScroll() {
    const el = chatWindowRef.current;
    if (!el) return;

    const threshold = 40;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;

    isAtBottomRef.current = atBottom;
  }

  function clampPanelPosition(x, y) {
    const panelWidth = panelRef.current?.offsetWidth || 420;
    const panelHeight = panelRef.current?.offsetHeight || 520;

    const maxX = Math.max(8, window.innerWidth - panelWidth - 8);
    const maxY = Math.max(8, window.innerHeight - panelHeight - 8);

    return {
      x: Math.min(Math.max(8, x), maxX),
      y: Math.min(Math.max(8, y), maxY),
    };
  }

  function beginDrag(clientX, clientY) {
    dragStateRef.current = {
      dragging: true,
      startX: clientX,
      startY: clientY,
      originX: panelPosition.x,
      originY: panelPosition.y,
    };
  }

  function updateDrag(clientX, clientY) {
    const drag = dragStateRef.current;
    if (!drag.dragging) return;

    const nextX = drag.originX + (clientX - drag.startX);
    const nextY = drag.originY + (clientY - drag.startY);

    setPanelPosition(clampPanelPosition(nextX, nextY));
  }

  function endDrag() {
    dragStateRef.current.dragging = false;
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  }

  function handleMouseMove(e) {
    updateDrag(e.clientX, e.clientY);
  }

  function handleMouseUp() {
    endDrag();
  }

  function shouldIgnoreDragStart(target) {
    return Boolean(
      target?.closest(
        'button, a, input, select, textarea, label, [role="button"], [data-no-drag="true"]',
      ),
    );
  }

  function handleMouseDown(e) {
    if (isMobile) return;
    if (e.button !== 0) return;
    if (shouldIgnoreDragStart(e.target)) return;

    e.preventDefault();

    beginDrag(e.clientX, e.clientY);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  async function handleSend() {
  const trimmed = message.trim();
  if (!trimmed) return;
  if (!schema?._id || !extensionsApi?.projectChat?.add) return;

  const payload = {
    message: trimmed,
  };

  const validation = validateProjectChatMessagePayload(schema, payload);

  if (!validation.isValid) {
    system?.notify?.(validation.error || "Invalid chat message.");
    return;
  }

  const { data: apiResponse, message: apiMessage } =
    await extensionsApi.projectChat.add(schema._id, payload);

  if (apiMessage) system?.notify?.(apiMessage);

  if (Array.isArray(apiResponse?.messages)) {
    setMessages(apiResponse.messages);
    isAtBottomRef.current = true;
    setMessage("");
  }
}

  function handleComposerKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!isOpen) return null;

  const rootClassName = isMobile
    ? "floating-chat-panel mobile"
    : "floating-chat-panel";

  return (
    <div
      ref={panelRef}
      className={rootClassName}
      role="region"
      aria-label="Project Chat"
      onMouseDown={handleMouseDown}
      style={
        isMobile
          ? undefined
          : {
              transform: `translate(${panelPosition.x}px, ${panelPosition.y}px)`,
            }
      }
    >
      <div
        className="floating-chat-panel-handle handle-section"
        aria-label="Drag chat panel"
      >
        <h2>Project Chat</h2>

        <button
          type="button"
          className="floating-chat-panel-close"
          aria-label="Close chat panel"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="floating-chat-panel-body">
        <div
          className="chat-window"
          ref={chatWindowRef}
          onScroll={handleScroll}
        >
          {loading && <p className="chat-empty">Loading chat…</p>}

          {!loading && messages.length === 0 && (
            <p className="chat-empty">No messages yet.</p>
          )}

          {!loading &&
            messages.map((m) => (
              <div
                key={m.id || `${m.senderName || "unknown"}-${m.createdAt}-${m.message}`}
                className="chat-message"
              >
                <strong className={`chat-user-color-${m.userColorTheme || "green"}`}>
                  {m.senderName || "Unknown"}:
                </strong>{" "}
                <span className="chat-message-text">{m.message}</span>
              </div>
            ))}

          <div ref={chatEndRef} />
        </div>

        <div className="chat-input-area" data-no-drag="true">
          <textarea
            className="chat-input"
            placeholder="Type a message…"
            value={message}
            maxLength={messageLength}
            rows={3}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleComposerKeyDown}
          />

          <button
            className="chat-send-btn"
            type="button"
            onClick={handleSend}
            disabled={!message.trim()}
          >
            Send
          </button>
        </div>

        <div className="chat-meta-inline">
          <span>
            {message.length}/{messageLength}
          </span>
        </div>
      </div>
    </div>
  );
}

export default ChatPanel;