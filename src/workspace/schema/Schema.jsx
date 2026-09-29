// src/workspace/schema/Schema.jsx
import { useMemo, useState, useEffect } from "react";
import SchemaLeftColumn from "./SchemaLeftColumn.jsx";
import SchemaMiddleColumn from "./SchemaMiddleColumn.jsx";
import SchemaRightColumn from "./SchemaRightColumn.jsx";
import SchemaFooter from "./SchemaFooter.jsx";

import { getEngine } from "../../engines/index.js";
import "./Schema.css";
import "../MainApp.css";

// ─────────────────────────────────────────────
// Get Default Preview Text String
// ─────────────────────────────────────────────
function parsePreviewTextString(previewText = "") {
  const settings = {};
  if (!previewText || typeof previewText !== "string") return settings;

  const parts = previewText.trim().split(/\s+/).filter(Boolean);
  const re = /^sections\[(\d+)\]\.inputs\[(\d+)\]\.(label|value)$/;
  const sawLabel = new Set();

  for (const token of parts) {
    const m = token.match(re);
    if (!m) continue;

    const sectionIndex = Number(m[1]);
    const inputIndex = Number(m[2]);
    const field = m[3];
    const key = `${sectionIndex}_${inputIndex}`;

    if (field === "label") {
      sawLabel.add(key);
      continue;
    }

    if (field === "value") {
      settings[key] = sawLabel.has(key) ? "labelValue" : "value";
      sawLabel.delete(key);
    }
  }

  return settings;
}

function Schema({
  setCurrentPage,
  system,
  apis,
  schema,
  setSchema,
  projectId,
  setProjectId,
  setProjects,
}) {
  const SETTINGS_SECTION_KEY = "__settings__";
  const GEOMETRY_SECTION_KEY = "__geometry__";
  const TIME_SECTION_KEY = "__time__";
  const EXTENSIONS_SECTION_KEY = "__extensions__";

  useEffect(() => {
    setCurrentPage("schema");
  }, []);

  const [selectedSectionIndex, setSelectedSectionIndex] = useState(
    SETTINGS_SECTION_KEY,
  );
  const [selectedInputIndex, setSelectedInputIndex] = useState(null);
  const [previewTextSettings, setPreviewTextSettings] = useState({});
  const [showLeftColumn, setShowLeftColumn] = useState(false);
  const [showRightColumn, setShowRightColumn] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [draftSchema, setDraftSchema] = useState(null);

  const currentEngine = useMemo(() => {
    if (!schema?.engineKey) return;
    return getEngine(schema.engineKey);
  }, [schema._id]);

  useEffect(() => {
    if (!schema) return;
    setDraftSchema(structuredClone(schema));
  }, [schema._id]);

  useEffect(() => {
    if (!draftSchema?.previewText) {
      setPreviewTextSettings({});
      return;
    }

    setPreviewTextSettings(parsePreviewTextString(draftSchema.previewText));
  }, [draftSchema?._id, draftSchema?.previewText]);

  if (!draftSchema || !currentEngine) return null;

  return (
    <>
      <button
        className={`left-side-toggle${
          showLeftColumn ? "" : " left-collapsed-toggle"
        }`}
        onClick={() => setShowLeftColumn(!showLeftColumn)}
      >
        ☰
      </button>

      <button
        className={`right-side-toggle${
          showRightColumn ? "" : " right-collapsed-toggle"
        }`}
        onClick={() => setShowRightColumn(!showRightColumn)}
      >
        ☰
      </button>

      <button
        className={`drawer-toggle-button ${showDrawer ? "active" : ""}`}
        onClick={() => setShowDrawer(!showDrawer)}
      >
        {showDrawer ? "▼" : "▲"}
      </button>

      <div className="schema-builder-container">
        <div
          className={`left-overlay-panel left-panel-wrapper ${
            showLeftColumn ? "" : "left-collapsed"
          }`}
        >
          <SchemaLeftColumn
            draftSchema={draftSchema}
            setDraftSchema={setDraftSchema}
            selectedSectionIndex={selectedSectionIndex}
            setSelectedSectionIndex={setSelectedSectionIndex}
            setSelectedInputIndex={setSelectedInputIndex}
            schemaRules={currentEngine.schemaRules}
            previewTextSettings={previewTextSettings}
            setPreviewTextSettings={setPreviewTextSettings}
            SETTINGS_SECTION_KEY={SETTINGS_SECTION_KEY}
            GEOMETRY_SECTION_KEY={GEOMETRY_SECTION_KEY}
            TIME_SECTION_KEY={TIME_SECTION_KEY}
            EXTENSIONS_SECTION_KEY={EXTENSIONS_SECTION_KEY}
          />
        </div>

        <SchemaMiddleColumn
          draftSchema={draftSchema}
          setDraftSchema={setDraftSchema}
          selectedSectionIndex={selectedSectionIndex}
          selectedInputIndex={selectedInputIndex}
          setSelectedInputIndex={setSelectedInputIndex}
          schemaRules={currentEngine.schemaRules}
          extensions={currentEngine.extensions}
          previewTextSettings={previewTextSettings}
          setPreviewTextSettings={setPreviewTextSettings}
          SETTINGS_SECTION_KEY={SETTINGS_SECTION_KEY}
          GEOMETRY_SECTION_KEY={GEOMETRY_SECTION_KEY}
          TIME_SECTION_KEY={TIME_SECTION_KEY}
          EXTENSIONS_SECTION_KEY={EXTENSIONS_SECTION_KEY}
        />

        <div
          className={`right-overlay-panel right-panel-wrapper ${
            showRightColumn ? "" : "right-collapsed"
          }`}
        >
       <SchemaRightColumn
  draftSchema={draftSchema}
  setDraftSchema={setDraftSchema}
  selectedSectionIndex={selectedSectionIndex}
  selectedInputIndex={selectedInputIndex}
  previewTextSettings={previewTextSettings}
  setPreviewTextSettings={setPreviewTextSettings}
  schemaRules={currentEngine.schemaRules}
  extensions={currentEngine.extensions}
  geometryTypes={currentEngine.geometry}
  SETTINGS_SECTION_KEY={SETTINGS_SECTION_KEY}
  GEOMETRY_SECTION_KEY={GEOMETRY_SECTION_KEY}
  TIME_SECTION_KEY={TIME_SECTION_KEY}
  EXTENSIONS_SECTION_KEY={EXTENSIONS_SECTION_KEY}
/>
        </div>
      </div>

      <SchemaFooter
        draftSchema={draftSchema}
        projectId={projectId}
        setProjects={setProjects}
        apis={apis}
        system={system}
        previewTextSettings={previewTextSettings}
        showDrawer={showDrawer}
      />
    </>
  );
}

export default Schema;