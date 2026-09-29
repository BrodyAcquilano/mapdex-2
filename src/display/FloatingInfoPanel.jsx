import { useEffect, useRef, useState } from "react";
import { renderInfoPanelBySchema } from "./renderInfoPanelBySchema";

import "./FloatingInfoPanel.css";

function FloatingInfoPanel({
  selectedDataItem,
  setSelectedDataItem,
  schema,
  viewerTimeZone,
  onOpenExtension,
  currentPage,
  analysisResult,
}) {

  const dragStateRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  const panelRef = useRef(null);

  const [panelPosition, setPanelPosition] = useState({
    x: 24,
    y: 24,
  });

  useEffect(() => {
    const width = 360;
    const height = 520;

    const rightOffset = 100;
    const desiredTop = 100;

    const maxX = Math.max(8, window.innerWidth - width - 8);
    const maxY = Math.max(8, window.innerHeight - height - 8);

    const desiredRightX = window.innerWidth - width - rightOffset;

    setPanelPosition({
      x: Math.min(Math.max(8, desiredRightX), maxX),
      y: Math.min(desiredTop, maxY),
    });
  }, []);

  const clampPanelPosition = (x, y) => {
    const panelWidth = panelRef.current?.offsetWidth || 360;
    const panelHeight = panelRef.current?.offsetHeight || 520;

    const maxX = Math.max(8, window.innerWidth - panelWidth - 8);
    const maxY = Math.max(8, window.innerHeight - panelHeight - 8);

    return {
      x: Math.min(Math.max(8, x), maxX),
      y: Math.min(Math.max(8, y), maxY),
    };
  };

  const beginDrag = (clientX, clientY) => {
    dragStateRef.current = {
      dragging: true,
      startX: clientX,
      startY: clientY,
      originX: panelPosition.x,
      originY: panelPosition.y,
    };
  };

  const updateDrag = (clientX, clientY) => {
    const drag = dragStateRef.current;
    if (!drag.dragging) return;

    const nextX = drag.originX + (clientX - drag.startX);
    const nextY = drag.originY + (clientY - drag.startY);

    setPanelPosition(clampPanelPosition(nextX, nextY));
  };

  const endDrag = () => {
    dragStateRef.current.dragging = false;
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e) => {
    updateDrag(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    endDrag();
  };

  const shouldIgnoreDragStart = (target) => {
    return Boolean(
      target?.closest(
        'button, a, input, select, textarea, label, [role="button"], [data-no-drag="true"]',
      ),
    );
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    if (shouldIgnoreDragStart(e.target)) return;

    e.preventDefault();

    beginDrag(e.clientX, e.clientY);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      ref={panelRef}
      className="floating-info-panel"
      role="region"
      aria-label="Info Panel"
      aria-describedby="floating-info-panel-description"
      onMouseDown={handleMouseDown}
      style={{
        transform: `translate(${panelPosition.x}px, ${panelPosition.y}px)`,
      }}
    >
      <div
        className="floating-info-panel-handle handle-section"
        aria-label="Drag info panel"
      >
        <h2 id="floating-info-panel-heading">Info Panel</h2>

        <button
          type="button"
          className="floating-info-panel-close"
          aria-label="Close info panel"
          onClick={() => setSelectedDataItem?.(null)}
        >
          ×
        </button>
      </div>

      <div className="floating-info-panel-body">
        <p id="floating-info-panel-description" className="visually-hidden">
          Displays details about the selected data item.
        </p>

        {renderInfoPanelBySchema(
          selectedDataItem,
          schema,
          viewerTimeZone,
          onOpenExtension,
          currentPage,
          analysisResult,
        )}
      </div>
    </div>
  );
}

export default FloatingInfoPanel;