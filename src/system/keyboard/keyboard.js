export function createKeyboardSystem() {
  const handlers = new Map();

  const keyAliases = {
    arrowup: "up",

    arrowdown: "down",

    arrowleft: "left",

    arrowright: "right",

    enter: "enter",
    escape: "escape",
  };

  function normalizeKey(key) {
    if (typeof key !== "string") return null;

    const k = key.toLowerCase();
    return keyAliases[k] || k;
  }

  function handleKeyDown(e) {
    const key = normalizeKey(e?.key);
    if (!key) return;

    if (handlers.has(key)) {
      handlers.get(key)(e);
    }
  }

  function registerShortcut(key, handler) {
    if (typeof key !== "string") return;
    handlers.set(key.toLowerCase(), handler);
  }

  function unregisterShortcut(key) {
    if (typeof key !== "string") return;
    handlers.delete(key.toLowerCase());
  }

  function init() {
    window.addEventListener("keydown", handleKeyDown);
  }

  function destroy() {
    window.removeEventListener("keydown", handleKeyDown);
  }

  return {
    init,
    destroy,
    registerShortcut,
    unregisterShortcut,
  };
}