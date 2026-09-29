import { useRef, useState, useEffect, useMemo } from "react";
import InfoPanel from "../display/InfoPanel.jsx";
import FloatingInfoPanel from "../display/FloatingInfoPanel.jsx";
import NeighbourhoodAnalysisPanel from "../analysis/neighbourhood/NeighbourhoodAnalysisPanel.jsx";
import "./pages.css";
import "../styles/panels.css";
import "./NeighbourhoodAnalysis.css";

const PROJECT_EXTENSION_ORDER = [
  {
    key: "Bulletin",
    label: "Open Bulletin",
    title: "Open Bulletin",
    icon: "📌",
    getMode: () => "viewer",
  },
  {
    key: "Chat",
    label: "Open Chat",
    title: "Open Chat",
    icon: "💬",
    getMode: () => "viewer",
  },
];

function NeighbourhoodAnalysis({
  selectedDataItem,
  setSelectedDataItem,
  schema,
  viewerTimeZone,
  onOpenExtension,
  setCurrentPage,
  ANALYSIS_COLORS,
  isMobile,
  analysisInputs,
  setAnalysisInputs,
  currentPage,
  analysisResult,
  analysisAlgorithm,
  setAnalysisAlgorithm,
  ALGORITHM_OPTIONS,
  activeExtensionModal,
  setActiveExtensionModal,
}) {
  const [showInfo, setShowInfo] = useState(false);
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);

  const dragStateRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  const [legendPosition, setLegendPosition] = useState({
    x: 0,
    y: 20,
  });

  useEffect(() => {
    setCurrentPage("analysis");
  }, []);

  useEffect(() => {
    if (isMobile) return;

    const legendWidth = 210;
    const desiredRightOffset = 80;
    const nextX = Math.max(
      0,
      window.innerWidth - legendWidth - desiredRightOffset,
    );

    setLegendPosition({
      x: nextX,
      y: 20,
    });
  }, [isMobile]);

  const enabledProjectExtensions = useMemo(() => {
    return PROJECT_EXTENSION_ORDER.filter(
      (extension) => schema?.extensions?.[extension.key]?.enabled === true,
    );
  }, [schema._id,  schema?.configUpdatedAt,]);

  function handleProjectExtensionClick(extension) {
    if (extension.key === "Chat") {
      if (
        activeExtensionModal?.key === "Chat" &&
        activeExtensionModal?.mode === "viewer"
      ) {
        setActiveExtensionModal?.(null);
        return;
      }
    }

    onOpenExtension?.(extension.key, extension.getMode());
  }

  const clampLegendPosition = (x, y) => {
    const legendWidth = 210;
    const legendHeight = 170;

    const maxX = Math.max(0, window.innerWidth - legendWidth - 8);
    const maxY = Math.max(0, window.innerHeight - legendHeight - 8);

    return {
      x: Math.min(Math.max(0, x), maxX),
      y: Math.min(Math.max(0, y), maxY),
    };
  };

  const beginDrag = (clientX, clientY) => {
    dragStateRef.current = {
      dragging: true,
      startX: clientX,
      startY: clientY,
      originX: legendPosition.x,
      originY: legendPosition.y,
    };
  };

  const updateDrag = (clientX, clientY) => {
    const drag = dragStateRef.current;
    if (!drag.dragging) return;

    const nextX = drag.originX + (clientX - drag.startX);
    const nextY = drag.originY + (clientY - drag.startY);

    setLegendPosition(clampLegendPosition(nextX, nextY));
  };

  const endDrag = () => {
    dragStateRef.current.dragging = false;
    window.removeEventListener("mousemove", handleLegendMouseMove);
    window.removeEventListener("mouseup", handleLegendMouseUp);
  };

  const shouldIgnoreLegendDragStart = (target) => {
    return Boolean(
      target?.closest(
        'button, a, input, select, textarea, label, [role="button"]',
      ),
    );
  };

  const handleLegendMouseDown = (e) => {
    if (isMobile) return;
    if (e.button !== 0) return;
    if (shouldIgnoreLegendDragStart(e.target)) return;

    e.preventDefault();

    beginDrag(e.clientX, e.clientY);
    window.addEventListener("mousemove", handleLegendMouseMove);
    window.addEventListener("mouseup", handleLegendMouseUp);
  };

  const handleLegendMouseMove = (e) => {
    updateDrag(e.clientX, e.clientY);
  };

  const handleLegendMouseUp = () => {
    endDrag();
  };

  const legendContent = (
    <>
      <div className="analysis-legend-handle" aria-label="Drag analysis legend">
        Analysis Legend
      </div>

      <div className="analysis-legend-list">
        <div className="analysis-legend-item">
          <span
            className="analysis-legend-dot"
            style={{
              backgroundColor: ANALYSIS_COLORS?.most?.fillColor || "#22c55e",
            }}
            aria-hidden="true"
          />
          <span>Most Access</span>
        </div>

        <div className="analysis-legend-item">
          <span
            className="analysis-legend-dot"
            style={{
              backgroundColor: ANALYSIS_COLORS?.average?.fillColor || "#c4254f",
            }}
            aria-hidden="true"
          />
          <span>Average Access</span>
        </div>

        <div className="analysis-legend-item">
          <span
            className="analysis-legend-dot"
            style={{
              backgroundColor: ANALYSIS_COLORS?.least?.fillColor || "#4466ef",
            }}
            aria-hidden="true"
          />
          <span>Least Access</span>
        </div>

        <div className="analysis-legend-item">
          <span
            className="analysis-legend-dot"
            style={{
              backgroundColor:
                ANALYSIS_COLORS?.fallback?.fillColor || "#f6be3b",
            }}
            aria-hidden="true"
          />
          <span>Insufficent Data</span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {enabledProjectExtensions.map((extension, index) => (
        <button
          key={extension.key}
          className="side-extension-button"
          style={{
            top: isMobile ? `${90 + index * 55}px` : `${95 + index * 55}px`,
            left: isMobile ? "10px" : "30px",
          }}
          onClick={() => handleProjectExtensionClick(extension)}
          aria-label={extension.label}
          title={extension.title}
        >
          {extension.icon}
        </button>
      ))}

      {isMobile ? (
        <div className="analysis-legend analysis-legend-mobile-fixed">
          {legendContent}
        </div>
      ) : (
        <div
          className="analysis-legend"
          onMouseDown={handleLegendMouseDown}
          style={{
            transform: `translate(${legendPosition.x}px, ${legendPosition.y}px)`,
          }}
        >
          {legendContent}
        </div>
      )}

      {isMobile && (
        <>
          <button
            className={`right-side-toggle right-toggle ${showInfo ? "" : "right-collapsed-toggle"}`}
            onClick={() => setShowInfo((prev) => !prev)}
            aria-label="Toggle Info Panel"
          >
            ☰
          </button>

          <div
            className={`right-overlay-panel right-panel-wrapper ${showInfo ? "" : "right-collapsed"}`}
            aria-hidden={!showInfo}
          >
            <InfoPanel
              selectedDataItem={selectedDataItem}
              schema={schema}
              viewerTimeZone={viewerTimeZone}
              onOpenExtension={onOpenExtension}
              currentPage={currentPage}
              analysisResult={analysisResult}
            />
          </div>
        </>
      )}

      {!isMobile && selectedDataItem && (
        <FloatingInfoPanel
          selectedDataItem={selectedDataItem}
          setSelectedDataItem={setSelectedDataItem}
          schema={schema}
          viewerTimeZone={viewerTimeZone}
          onOpenExtension={onOpenExtension}
          currentPage={currentPage}
          analysisResult={analysisResult}
        />
      )}

      <button
        className={`left-side-toggle left-toggle ${
          showAnalysisPanel ? "" : "left-collapsed-toggle"
        }`}
        onClick={() => setShowAnalysisPanel((prev) => !prev)}
        aria-label="Toggle Analysis Panel"
      >
        ☰
      </button>

      <div
        className={`left-overlay-panel left-panel-wrapper ${
          showAnalysisPanel ? "" : "left-collapsed"
        }`}
        aria-hidden={!showAnalysisPanel}
      >
        <NeighbourhoodAnalysisPanel
          analysisInputs={analysisInputs}
          setAnalysisInputs={setAnalysisInputs}
          analysisAlgorithm={analysisAlgorithm}
          setAnalysisAlgorithm={setAnalysisAlgorithm}
          ALGORITHM_OPTIONS={ALGORITHM_OPTIONS}
        />
      </div>
    </>
  );
}

export default NeighbourhoodAnalysis;