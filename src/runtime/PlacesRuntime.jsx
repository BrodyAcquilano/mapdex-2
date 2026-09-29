// src/runtime/PlacesRuntime.jsx

import { useState, useMemo } from "react";

//Api
import { placesApi } from "../api/placesApi";
import { galleryApi } from "../api/galleryApi";
import { guestbookApi } from "../api/guestbookApi.js";
import { projectChatApi } from "../api/projectChatApi";
import { bulletinApi } from "../api/bulletinApi";

//Forms
import { useGeometryDraftTools } from "../forms/hooks/useGeometryDraftTools.js";
import { useTrackLocationToggle } from "../workspace/TrackLocationButton/hooks/useTrackLocationToggle.js";

export function usePlacesRuntime({
  schema,
  setData,
  trackLocation,
  setTrackLocation,
  dataUtils,
  blankFormTemplate,
}) {
  const [draftGeometry, setDraftGeometry] = useState(null);
  /*
   * Undo history for the "remove point"/"add midpoint" edit tools: a
   * stack of draftGeometry snapshots taken right before each vertex
   * mutation, so Undo restores them in the reverse order they were
   * made. Separate from the draw workflow's own simpler undo (popping
   * the last placed vertex, src/map/utils/draftGeometry.js's
   * removeLastDraftVertex), since these tools can mutate any index,
   * not just the end of the array.
   */
  const [geometryEditHistory, setGeometryEditHistory] = useState([]);
  const [showFilter, setShowFilter] = useState(false);
  const [isMiniGalleryOpen, setIsMiniGalleryOpen] = useState(false);
  const [geometryTool, setGeometryTool] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);

  const hasBottomUI = false;

  const apis = useMemo(
    () => ({
      engineApi: placesApi,
      extensionsApi: {
        gallery: galleryApi,
        guestbook: guestbookApi,
        projectChat: projectChatApi,
        bulletin: bulletinApi,
      },
    }),
    [],
  );

  /*
   * Draw and geometry-edit finish handlers - see
   * src/forms/hooks/useGeometryDraftTools.js. Both engine runtimes held
   * identical copies of these inline.
   */
  const { drawDraft, finishDrawing, addPanelOnClose, finishGeometryEdit } =
    useGeometryDraftTools({
      schema,
      blankFormTemplate,
      draftGeometry,
      setDraftGeometry,
      setIsDrawing,
      setToolbarVisible,
      setIsAddPanelOpen,
      geometryTool,
      apis,
      dataUtils,
      setData,
    });

  const handleTrackLocationToggle = useTrackLocationToggle({
    trackLocation,
    setTrackLocation,
  });

  return {
    draftGeometry,
    setDraftGeometry,
    geometryEditHistory,
    setGeometryEditHistory,
    showFilter,
    setShowFilter,
    geometryTool,
    setGeometryTool,
    isDrawing,
    setIsDrawing,
    finishGeometryEdit,
    toolbarVisible,
    setToolbarVisible,
    isAddPanelOpen,
    setIsAddPanelOpen,
    isMiniGalleryOpen,
    setIsMiniGalleryOpen,
    apis /*Read-Only */,
    drawDraft,
    finishDrawing,
    addPanelOnClose,
    hasBottomUI /*Read-Only*/,
    handleTrackLocationToggle,
  };
}
