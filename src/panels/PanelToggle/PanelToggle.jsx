// src/panels/PanelToggle/PanelToggle.jsx

import "../../workspace/MainApp.css";

/*
 * The ☰ button that slides an overlay panel in and out. One component
 * for both sides rather than a copy per feature - src/filters/
 * FilterToggle.jsx predates this and is still its own file (it's shared
 * by Viewer/Editor and every engine, so it isn't Layers/Aggregates
 * specific), but every panel added since would otherwise have been the
 * same dozen lines repeated.
 *
 * The class names it drives (left-side-toggle/right-side-toggle and the
 * matching *-collapsed-toggle) live in workspace/MainApp.css alongside
 * the .left-overlay-panel/.right-overlay-panel rules the panels
 * themselves use, so a panel and its toggle stay in sync by sharing the
 * same `isOpen` flag - see PanelContainer below.
 */
export default function PanelToggle({ side = "left", isOpen, setIsOpen, label }) {
  const isLeft = side === "left";

  const sideClass = isLeft ? "left-side-toggle left-toggle" : "right-side-toggle right-toggle";
  const collapsedClass = isLeft ? "left-collapsed-toggle" : "right-collapsed-toggle";

  return (
    <button
      type="button"
      className={`${sideClass} ${isOpen ? "" : collapsedClass}`}
      aria-label={label}
      aria-expanded={isOpen}
      onClick={() => setIsOpen(!isOpen)}
    >
      ☰
    </button>
  );
}

/*
 * The sliding panel itself. Pairs with PanelToggle above - both read the
 * same `isOpen`, so they can never disagree about whether the panel is
 * on screen. `aria-hidden` matters here: a collapsed panel is only moved
 * off-screen by a transform, so without it every control inside stays
 * reachable by screen readers and tab order while invisible.
 */
export function PanelContainer({ side = "left", isOpen, children }) {
  const isLeft = side === "left";

  const sideClass = isLeft
    ? "left-overlay-panel left-panel-wrapper"
    : "right-overlay-panel right-panel-wrapper";

  const collapsedClass = isLeft ? "left-collapsed" : "right-collapsed";

  return (
    <div
      className={`${sideClass} ${isOpen ? "" : collapsedClass}`}
      aria-hidden={!isOpen}
    >
      {children}
    </div>
  );
}
