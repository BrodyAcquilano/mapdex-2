// src/runtime/EventRuntime.jsx

import { useState, useMemo } from "react";

//Api
import { eventsApi } from "../api/eventsApi";
import { galleryApi } from "../api/galleryApi";
import { guestbookApi } from "../api/guestbookApi";
import { projectChatApi } from "../api/projectChatApi";
import { bulletinApi } from "../api/bulletinApi";

//Forms
import { useGeometryDraftTools } from "../forms/hooks/useGeometryDraftTools.js";
import { useTrackLocationToggle } from "../workspace/TrackLocationButton/hooks/useTrackLocationToggle.js";

export function useEventsRuntime({
  schema,
  setData,
  trackLocation,
  setTrackLocation,
  dataUtils,
  blankFormTemplate,
}) {
  const [showFilter, setShowFilter] = useState(false);
  const [timeFilterOverride, setTimeFilterOverride] = useState(false);
  const [isMiniGalleryOpen, setIsMiniGalleryOpen] = useState(false);
  const [draftGeometry, setDraftGeometry] = useState(null);
  /*
   * Undo history for the "remove point"/"add midpoint" edit tools -
   * see the matching comment in PlacesRuntime.jsx.
   */
  const [geometryEditHistory, setGeometryEditHistory] = useState([]);
  const [geometryTool, setGeometryTool] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);

  const apis = useMemo(
    () => ({
      engineApi: eventsApi,
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
    timeFilterOverride,
    setTimeFilterOverride,
    isMiniGalleryOpen,
    setIsMiniGalleryOpen,
    draftGeometry,
    setDraftGeometry,
    geometryEditHistory,
    setGeometryEditHistory,
    apis /*Read-Only */,
    drawDraft,
    finishDrawing,
    addPanelOnClose,
    handleTrackLocationToggle,
  };
}
