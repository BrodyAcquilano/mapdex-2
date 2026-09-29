// src/runtime/MotionRuntime.jsx

import { useState, useMemo, useRef } from "react";

// Api
import { motionApi } from "../api/motionApi";
import { galleryApi } from "../api/galleryApi";
import { projectChatApi } from "../api/projectChatApi";
import { bulletinApi } from "../api/bulletinApi";
import { useTrackLocationToggle } from "../workspace/TrackLocationButton/hooks/useTrackLocationToggle.js";

// Data

export function useMotionRuntime({ trackLocation, setTrackLocation }) {
  const [showFilter, setShowFilter] = useState(false);
  const [isMiniGalleryOpen, setIsMiniGalleryOpen] = useState(false);

  const [motionSamples, setMotionSamples] = useState([]);
  const motionSamplesRef = useRef([]);

  const apis = useMemo(
    () => ({
      engineApi: motionApi,
      extensionsApi: {
        gallery: galleryApi,
        projectChat: projectChatApi,
        bulletin: bulletinApi,
      },
    }),
    [],
  );

  function appendMotionSample(sample) {
    setMotionSamples((prev) => {
      const next = [...prev, sample];
      motionSamplesRef.current = next;
      return next;
    });
  }

  function clearMotionSamples() {
    motionSamplesRef.current = [];
    setMotionSamples([]);
  }

  /*
   * Motion clears its own recorded samples whenever tracking starts -
   * the one engine-specific part of this toggle, passed in rather than
   * branched on inside the shared hook.
   */
  const handleTrackLocationToggle = useTrackLocationToggle({
    trackLocation,
    setTrackLocation,
    onStartTracking: clearMotionSamples,
  });

  return {
    showFilter,
    setShowFilter,

    isMiniGalleryOpen,
    setIsMiniGalleryOpen,

    motionSamples,
    setMotionSamples,
    motionSamplesRef,
    appendMotionSample,
    clearMotionSamples,

    apis,

    handleTrackLocationToggle,
  };
}
