export function trapFocus(container, onClose) {
  const focusable = container.querySelectorAll(
    'button, [href], select, textarea, input, [tabindex]:not([tabindex="-1"])'
  );

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  function handleKey(e) {
    if (e.key === "Escape") {
      onClose?.();
    }

    if (e.key === "Tab") {
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }

  document.addEventListener("keydown", handleKey);

  return () => {
    document.removeEventListener("keydown", handleKey);
  };
}