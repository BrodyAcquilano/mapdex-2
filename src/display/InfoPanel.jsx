import { useState } from "react";
import "../styles/panels.css";
import { renderInfoPanelBySchema } from "./renderInfoPanelBySchema";

function InfoPanel({
  selectedDataItem,
  schema,
  viewerTimeZone,
  onOpenExtension,
  currentPage,
  analysisResult,
}) {
  const [displayTimeMode, setDisplayTimeMode] = useState("source");
  const [overrideTimeZone, setOverrideTimeZone] = useState(viewerTimeZone);

  if (!selectedDataItem) {
    return (
      <div
        className="panel"
        role="region"
        aria-label="Info Panel"
        aria-describedby="info-panel-description"
      >
        <div className="section">
          <h2 id="info-panel-heading">Info Panel</h2>
        </div>
        <p id="info-panel-description" className="info-panel-description">
          Select a data item to view details.
        </p>
      </div>
    );
  }

  return (
    <div
      className="panel"
      role="region"
      aria-label="Info Panel"
      aria-describedby="info-panel-description"
    >
      <div className="section">
        <h2 id="info-panel-heading">Info Panel</h2>
      </div>

      <p id="info-panel-description" className="visually-hidden">
        Displays details about the selected data item.
      </p>

      {renderInfoPanelBySchema(
        selectedDataItem,
        schema,
        viewerTimeZone,
        onOpenExtension,
        currentPage,
        analysisResult,
        displayTimeMode,
        setDisplayTimeMode,
        overrideTimeZone,
        setOverrideTimeZone,
      )}
    </div>
  );
}

export default InfoPanel;