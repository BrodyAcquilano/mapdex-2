// src/workspace/LayerButton/LayerButton.jsx

import { useEffect, useState } from "react";
import { Layers, ChevronDown, ChevronUp } from "lucide-react";
import Tooltip from "../../system/notifications/Tooltip";

import "./LayerButton.css";

export default function LayerButton({
  activeLayer,
  activeParentDataItemId,
  selectedDataItem,
  filteredData,
  setActiveLayer,
  setActiveParentDataItemId,
  setSelectedDataItem,
  setIsMiniGalleryOpen,
  system,
  isMobile,
  hasBottomUI,
}) {
  const [hovered, setHovered] = useState(false);

  const layer = Number(activeLayer || 1);
  const isLayerTwo = layer === 2;

  const canEnterLayerTwo =
    layer === 1 &&
    selectedDataItem?._id &&
    Number(selectedDataItem?.layer || 1) === 1;

  const shouldRender = canEnterLayerTwo || isLayerTwo;

  useEffect(() => {
    if (isMobile && hovered) {
      setHovered(false);
    }
  }, [isMobile, hovered]);

  if (!shouldRender) return null;

  function findVisibleParentItem() {
    if (!activeParentDataItemId || !Array.isArray(filteredData)) return null;

    return (
      filteredData.find(
        (dataItem) =>
          Number(dataItem?.layer || 1) === 1 &&
          String(dataItem?._id) === String(activeParentDataItemId),
      ) || null
    );
  }

  function handleLayerClick() {
    if (isLayerTwo) {
      const visibleParentItem = findVisibleParentItem();

      setActiveLayer?.(1);
      setActiveParentDataItemId?.(null);
      setSelectedDataItem?.(visibleParentItem);
      setIsMiniGalleryOpen?.(false);

      system?.notify?.("Moved to layer 1.");
      return;
    }

    if (!selectedDataItem?._id) return;

    setActiveLayer?.(2);
    setActiveParentDataItemId?.(selectedDataItem._id);
    setSelectedDataItem?.(null);
    setIsMiniGalleryOpen?.(false);

    system?.notify?.("Moved to layer 2.");
  }

  const label = isLayerTwo ? "Return to layer 1" : "Open layer 2";

  return (
    <div
      className={`layer-button-container ${
        hasBottomUI ? "with-bottom-ui" : ""
      }`}
    >
      <button
        className={`layer-button ${isLayerTwo ? "active" : ""}`}
        onClick={handleLayerClick}
        aria-label={label}
        aria-pressed={isLayerTwo}
        onMouseEnter={!isMobile ? () => setHovered(true) : undefined}
        onMouseLeave={!isMobile ? () => setHovered(false) : undefined}
      >
        <Layers className="layer-icon" />

        {isLayerTwo ? (
          <ChevronUp className="layer-arrow-icon" />
        ) : (
          <ChevronDown className="layer-arrow-icon" />
        )}
      </button>

      {!isMobile && hovered && (
        <Tooltip text={label} position="top-left-60-60" />
      )}
    </div>
  );
}