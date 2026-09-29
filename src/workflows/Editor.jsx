// src/workflows/Editor.jsx

import { useState, useEffect, useMemo, useRef } from "react";

import EditPanel from "../forms/EditPanel.jsx";
import AddPanel from "../forms/AddPanel.jsx";
import ImportGeometryFileInput from "../forms/ImportGeometryFileInput.jsx";

import GeometryToolWheel from "../map/tools/GeometryToolWheel.jsx";
import DrawingActionButtons from "../map/tools/DrawingActionButtons.jsx";

import { createDraftGeometry } from "../map/utils/draftGeometry.js";
import { handleDelete } from "../forms/submitHandlers.js";

import "./pages.css";

const DRAW_TOOL_KEYS = [
  "point",
  "line",
  "polygon",
  "multipoint",
  "multiline",
  "multipolygon",
];

const MOVE_TOOL_KEY = "move";

/*
 * Deliberately not in DRAW_TOOL_KEYS or EDIT_TOOL_KEYS below - it
 * needs neither draftGeometry nor DrawLayer's vertex handling, just
 * the ordinary click-to-select behavior every map layer already gives
 * any tool that isn't a draw or edit tool. See the effect further
 * down that actually drives the delete workflow once a click selects
 * something while this tool is active.
 */
const DELETE_TOOL_KEY = "delete";

const REMOVE_SUBGEOMETRY_TOOL_KEY = "removeSubgeometry";
const ADD_SUBGEOMETRY_TOOL_KEY = "addSubgeometry";
const MOVE_GEOMETRY_TOOL_KEY = "moveGeometry";

/*
 * Every geometry edit tool (as opposed to a draw tool): all of them
 * let the user select an existing item, show its vertices, block
 * popups, and finish by sending the edited geometry to the shared
 * update-geometry route (see finishGeometryEdit in
 * PlacesRuntime.jsx/EventRuntime.jsx) - they only differ in what
 * clicking a vertex does (drag it, remove it, or pick it for a
 * midpoint insertion). removeSubgeometry works a level up from the
 * other three - removing a whole point/line/polygon out of a
 * MultiPoint/MultiLineString/MultiPolygon, not one vertex within one -
 * so GeometryLayer.jsx's own click handler (both engines) is the one
 * that restricts it to only ever selecting one of those three types,
 * never a plain Point/LineString/Polygon. addSubgeometry is the
 * inverse of that restriction - it selects ANY of the 6 types (see the
 * same click handler), converting the selection into an addable Multi-
 * type draft via createAddSubgeometryDraft (draftGeometry.js) instead
 * of cloning it verbatim the way the other four do, then re-enters a
 * draw-like click-to-add-a-vertex workflow (see each map library's own
 * DrawController/useDrawController, which folds this tool into their
 * existing multipoint/multiline/multipolygon click branches once
 * draftGeometry's own type says which one applies) to add a whole new
 * point/line/polygon on top of what was already there.
 *
 * moveGeometry is move's own alt tool - rather than dragging one
 * vertex at a time, it drags a single handle at the whole item's own
 * stored centroid (createAddSubgeometryDraft's sibling,
 * getGeometryHandlePosition in draftGeometry.js decides where that
 * handle sits per type) and rigidly translates every coordinate in the
 * draft together via translateGeometryByDelta, updating bbox/centroid/
 * midpoint by the same delta rather than recomputing them. Selects any
 * of the 6 types, same as addSubgeometry - there's no type this
 * doesn't make sense for, including Point (translateGeometryByDelta
 * already handles a Point's own single coordinate correctly with no
 * special-casing needed).
 */
const EDIT_TOOL_KEYS = [
  MOVE_TOOL_KEY,
  MOVE_GEOMETRY_TOOL_KEY,
  "midpoint",
  ADD_SUBGEOMETRY_TOOL_KEY,
  "remove",
  REMOVE_SUBGEOMETRY_TOOL_KEY,
];

const PROJECT_EXTENSION_ORDER = [
  {
    key: "Bulletin",
    label: "Open Bulletin",
    title: "Open Bulletin",
    icon: "📌",
    getMode: () => "editor",
  },
  {
    key: "Chat",
    label: "Open Chat",
    title: "Open Chat",
    icon: "💬",
    getMode: () => "viewer",
  },
];



function Editor({
  setData,
  selectedDataItem,
  setSelectedDataItem,
  schema,
  setSchema,
  geometryTool,
  setGeometryTool,
  isDrawing,
  setIsDrawing,
  finishGeometryEdit,
  draftGeometry,
  setDraftGeometry,
  geometryEditHistory,
  setGeometryEditHistory,
  toolbarVisible,
  /*
   * The geometry filter's own boundary picker takes the screen over
   * with its own Back/Select Boundary row, which sits exactly where the
   * tool wheel does - so the wheel stands down while that is open
   * rather than overlapping it.
   */
  isSelectingFilterBoundary,
  setToolbarVisible,
  isAddPanelOpen,
  setIsAddPanelOpen,
  finishDrawing,
  addPanelOnClose,
  onOpenExtension,
  setIsMiniGalleryOpen,
  setCurrentPage,
  blankFormTemplate,
  forms,
  dataUtils,
  system,
  map,
  apis,
  isMobile,
  activeExtensionModal,
  setActiveExtensionModal,
  activeLayer,
  activeParentDataItemId,
}) {
  const [showEditPanel, setShowEditPanel] = useState(false);

  const previousAddPanelOpenRef = useRef(false);
  const importGeometryFileInputRef = useRef(null);

  useEffect(() => {
    setCurrentPage("editor");
  }, []);

  useEffect(() => {
    setGeometryTool(null);
    setIsDrawing(false);
    setDraftGeometry(null);
    setGeometryEditHistory?.([]);
    setIsAddPanelOpen(false);
    setToolbarVisible(true);

    return () => {
      setGeometryTool(null);
      setIsDrawing(false);
      setDraftGeometry(null);
      setGeometryEditHistory?.([]);
      setIsAddPanelOpen(false);
      setToolbarVisible(true);
    };
  }, [
    schema._id,
    setGeometryTool,
    setIsDrawing,
    setDraftGeometry,
    setGeometryEditHistory,
    setIsAddPanelOpen,
    setToolbarVisible,
  ]);

  useEffect(() => {
    if (isDrawing && DRAW_TOOL_KEYS.includes(geometryTool) && !draftGeometry) {
      setDraftGeometry(createDraftGeometry(geometryTool));
    }
  }, [geometryTool, isDrawing, draftGeometry, setDraftGeometry]);

  /*
   * Selecting a different item is its own fresh start for editing,
   * not a continuation of whatever undo history the previous item had
   * built up - per Brody's own call: without this, pressing "Back"
   * enough times after switching items would walk back past the
   * current item's own edits and into the previous item's, which
   * looks like editing two items in one session even though only one
   * can ever actually be saved. GeometryLayer.jsx (both engines)
   * already repopulates draftGeometry fresh from whichever item was
   * just clicked, discarding any unfinished edit on the one before it
   * - this is the other half of that same "no carryover" guarantee,
   * for the undo stack specifically. Keyed on the item's own id, not
   * geometryTool (that's already handled by its own reset above) or
   * draftGeometry (which changes on every edit, exactly the history
   * this shouldn't wipe).
   */
  useEffect(() => {
    setGeometryEditHistory?.([]);
  }, [selectedDataItem?._id, setGeometryEditHistory]);

  useEffect(() => {
    if (isAddPanelOpen) {
      setShowEditPanel(false);
    } else if (previousAddPanelOpenRef.current) {
      setShowEditPanel(true);
    }

    previousAddPanelOpenRef.current = isAddPanelOpen;
  }, [isAddPanelOpen]);

  const enabledProjectExtensions = useMemo(() => {
    return PROJECT_EXTENSION_ORDER.filter(
      (extension) => schema?.extensions?.[extension.key]?.enabled === true,
    );
  }, [schema._id, schema?.configUpdatedAt]);

function handleGeometryToolChange(nextTool) {
  /*
   * Import Geometry is a one-shot action, not a persistent mode the
   * way every draw/edit tool is - selecting it triggers the OS file
   * picker directly (ImportGeometryFileInput.jsx's own hidden input),
   * with no modal or confirmation step in between, and leaves
   * geometryTool untouched throughout. Since it's never actually set
   * as the active tool, there's nothing to visually deselect once the
   * import finishes (pass or fail) - it was only ever a momentary
   * trigger, per Brody's own call.
   */
  if (nextTool === "importGeometry") {
    importGeometryFileInputRef.current?.click();
    return;
  }

  /*
   * Re-selecting an edit tool while it's already active on the same
   * selected item is a no-op: the item is already selected and its
   * draft is already in progress, so there's nothing to (re)populate.
   * Without this guard, the code below would reset draftGeometry back
   * to the item's last-saved geometry, discarding any in-progress
   * edit - Mapbox's imperative vertex/point markers don't get
   * recreated by that reset (their effect only depends on vertex
   * count/type, not live coordinates, so dragging stays smooth), so
   * they'd visually stay put at their edited position while the
   * reactively-rendered connecting line snapped back underneath them,
   * leaving the two disconnected.
   */
  if (
    EDIT_TOOL_KEYS.includes(nextTool) &&
    geometryTool === nextTool &&
    selectedDataItem?.geometry
  ) {
    return;
  }

  setGeometryTool(nextTool);

  setIsDrawing(
    DRAW_TOOL_KEYS.includes(nextTool) ||
    EDIT_TOOL_KEYS.includes(nextTool),
  );

  setGeometryEditHistory?.([]);

  /*
   * Switching to an edit tool - any of them - starts from a clean
   * slate rather than trying to carry an already-selected item's
   * draft over from whatever tool was active before, per Brody's own
   * call: auto-populating the draft from selectedDataItem here used
   * to leave the map layers' own click/drag machinery looking at a
   * selection that never went through their own "just clicked" path,
   * which was the root of vertices/parts silently not responding to
   * clicks after a tool switch. A fresh click after switching tools
   * always goes through GeometryLayer.jsx's own handleGeometryClick
   * instead, which sets selectedDataItem and draftGeometry together
   * in the one place that's actually meant to.
   */
  if (EDIT_TOOL_KEYS.includes(nextTool)) {
    setSelectedDataItem(null);
  }

  setDraftGeometry(null);

  /*
   * Adding a new point/line/polygon has nothing to do with whatever
   * item was previously selected - clearing it here (rather than
   * leaving it selected until the user happens to click something
   * else) is what lets GeometryLayer.jsx block clicks on existing
   * items from selecting while a draw tool is active, so a click
   * always just places/extends the new draft.
   */
  if (DRAW_TOOL_KEYS.includes(nextTool)) {
    setSelectedDataItem(null);
  }

  /*
   * Whatever was selected before opening the delete tool isn't
   * necessarily what the user means to delete - clearing it here
   * means switching to this tool always starts from "nothing
   * selected," so the delete-confirmation effect below only ever
   * fires for an item the user actually clicked after picking this
   * tool, never for a stale prior selection.
   */
  if (nextTool === DELETE_TOOL_KEY) {
    setSelectedDataItem(null);
  }
}

/*
 * The delete tool has no dedicated click handler of its own anywhere
 * in GeometryLayer.jsx (Leaflet) or its Mapbox equivalent - it isn't
 * a draw or edit tool, so those layers already fall through to their
 * ordinary click-to-select behavior for it. This effect is what turns
 * that plain selection into the actual delete workflow: as soon as
 * selecting something while this tool is active, ask for
 * confirmation and, if confirmed, delete it via the same handleDelete
 * used by the edit panel's own "Delete Data" button. Clearing
 * selectedDataItem afterward regardless of the outcome (handleDelete
 * already does this itself on a successful delete, so this is only
 * ever a no-op then) means a cancelled confirmation still leaves the
 * tool ready for the next click, rather than treating the item as
 * "still selected" with nothing to actually do with that selection.
 */
useEffect(() => {
  if (geometryTool !== DELETE_TOOL_KEY || !selectedDataItem) return;

  let cancelled = false;

  (async () => {
    await handleDelete({
      schema,
      selectedDataItem,
      system,
      apis,
      dataUtils,
      setData,
      setDraftGeometry,
      setSelectedDataItem,
      setSchema,
    });

    if (!cancelled) {
      setSelectedDataItem(null);
    }
  })();

  return () => {
    cancelled = true;
  };
  // Keyed on the selected item's own id (plus the tool itself) rather
  // than the whole selectedDataItem object/every other callback prop
  // here, the same pattern GeometryLayer.jsx's own focus effect uses -
  // this should fire once per distinct selection while this tool is
  // active, not on every unrelated re-render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [geometryTool, selectedDataItem?._id]);

async function handleFinishGeometry() {
  if (EDIT_TOOL_KEYS.includes(geometryTool)) {
    const updatedDataItem =
      await finishGeometryEdit(
        selectedDataItem,
        system,
      );

    if (updatedDataItem) {
      setSelectedDataItem(
        updatedDataItem,
      );

      setGeometryEditHistory?.([]);
    }

    return;
  }

  finishDrawing(system);
}

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

  const rightPanelOpen = isAddPanelOpen || (!isDrawing && showEditPanel);

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

      {!isAddPanelOpen && !isDrawing && (
        <button
          className={`right-side-toggle right-toggle ${
            showEditPanel ? "" : "right-collapsed-toggle"
          }`}
          onClick={() => setShowEditPanel(!showEditPanel)}
          aria-label="Toggle Edit Panel"
        >
          ☰
        </button>
      )}

      <div
        className={`right-overlay-panel right-panel-wrapper ${
          rightPanelOpen ? "" : "right-collapsed"
        }`}
        aria-hidden={!rightPanelOpen}
      >
        {isAddPanelOpen ? (
          <AddPanel
            isOpen={isAddPanelOpen}
            onClose={addPanelOnClose}
            draftGeometry={draftGeometry}
            setDraftGeometry={setDraftGeometry}
            setData={setData}
            setSelectedDataItem={setSelectedDataItem}
            schema={schema}
            setSchema={setSchema}
            blankFormTemplate={blankFormTemplate}
            forms={forms}
            dataUtils={dataUtils}
            system={system}
            apis={apis}
            activeLayer={activeLayer}
            activeParentDataItemId={activeParentDataItemId}
          />
        ) : !isDrawing ? (
          <EditPanel
            setData={setData}
            selectedDataItem={selectedDataItem}
            setSelectedDataItem={setSelectedDataItem}
            schema={schema}
            setSchema={setSchema}
            onOpenExtension={onOpenExtension}
            setIsMiniGalleryOpen={setIsMiniGalleryOpen}
            blankFormTemplate={blankFormTemplate}
            forms={forms}
            dataUtils={dataUtils}
            system={system}
            map={map}
            apis={apis}
            setDraftGeometry={setDraftGeometry}
          />
        ) : null}
      </div>

    {toolbarVisible && !isAddPanelOpen && !isSelectingFilterBoundary && (
  <GeometryToolWheel
    geometryTool={geometryTool}
    setGeometryTool={handleGeometryToolChange}
    geometryTypes={schema.geometry.types}
    isMobile={isMobile}
  />
)}

      {toolbarVisible && !isAddPanelOpen && (
        <DrawingActionButtons
          isDrawing={isDrawing}
          geometryTool={geometryTool}
          draftGeometry={draftGeometry}
          setDraftGeometry={setDraftGeometry}
          geometryEditHistory={geometryEditHistory}
          setGeometryEditHistory={setGeometryEditHistory}
          onFinish={handleFinishGeometry}
        />
      )}

      <ImportGeometryFileInput
        ref={importGeometryFileInputRef}
        setData={setData}
        schema={schema}
        blankFormTemplate={blankFormTemplate}
        forms={forms}
        dataUtils={dataUtils}
        system={system}
        apis={apis}
        map={map}
        activeLayer={activeLayer}
        activeParentDataItemId={activeParentDataItemId}
      />
    </>
  );
}

export default Editor;
