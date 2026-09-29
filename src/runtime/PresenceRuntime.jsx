//src/runtime/PresenceRuntime.jsx
import { useTrackLocationToggle } from "../workspace/TrackLocationButton/hooks/useTrackLocationToggle.js";
import { useState, useMemo, useRef } from "react";

//Api
import { presenceApi } from "../api/presenceApi";
import { galleryApi } from "../api/galleryApi";
import { projectChatApi } from "../api/projectChatApi";
import { bulletinApi } from "../api/bulletinApi";

//Data

export function usePresenceRuntime({ trackLocation, setTrackLocation }) {
  const [showFilter, setShowFilter] = useState(false);
  const hasBottomUI = false;
  const [isMiniGalleryOpen, setIsMiniGalleryOpen] = useState(false);
  const [draftUser, setDraftUser] = useState(null);

  const draftUserRef = useRef(null);

  const apis = useMemo(
    () => ({
      engineApi: presenceApi,
      extensionsApi: {
        gallery: galleryApi,
        projectChat: projectChatApi,
        bulletin: bulletinApi,
      },
    }),
    [],
  );

  const handleTrackLocationToggle = useTrackLocationToggle({
    trackLocation,
    setTrackLocation,
  });

  return {
    draftUser,
    setDraftUser,
    draftUserRef,
    showFilter,
    setShowFilter,
    isMiniGalleryOpen,
    setIsMiniGalleryOpen,
    apis,
    hasBottomUI,
    handleTrackLocationToggle,
  };
}
