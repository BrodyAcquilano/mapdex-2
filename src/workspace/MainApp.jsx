// src/workspace/MainApp.jsx

// External Library Imports
import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";

//Workspace Imports
import Header from "./navigation/Header.jsx";
import ProjectTitle from "./ProjectTitle/ProjectTitle.jsx";
import SettingsToggle from "./settings/SettingsToggle.jsx";
import SettingsModal from "./settings/SettingsModal.jsx";

// Workspace Page Imports
import Projects from "./projects/Projects.jsx";
import Community from "./community/Community.jsx";
import MyProfile from "./profile/MyProfile.jsx";
import Schema from "./schema/Schema.jsx";
import Account from "./account/Account.jsx";

// Engine Switching Index Files
import { useAllRuntime } from "../runtime/index.js";
import { getEngine } from "../engines/index.js";
import MapShellHost from "../map/MapShellHost.jsx";
import { applySchemaMetadataDiffs } from "./utils/updateSchemaHelpers.js";

// Validation
import { validateDataItemPayload } from "../../shared/validation/dataValidation.js";
import { sanitizeLineStringGeometry } from "../../shared/validation/lineStringValidation.js";
import {
  buildPresenceSchemaMetadata,
  validatePresenceSchemaMetadata,
} from "../../shared/validation/presenceSchemaMetaDataValidation.js";

// Style Imports
import "./MainApp.css";

const LAST_PROJECT_KEY = "mapdex_last_project_id";

const DEFAULT_MOTION_LINE_COLOR = "#3388ff";

function cssColorToHex(value) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  const match = trimmed.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i,
  );

  if (!match) return null;

  const r = Number(match[1]);
  const g = Number(match[2]);
  const b = Number(match[3]);

  if (
    !Number.isInteger(r) ||
    !Number.isInteger(g) ||
    !Number.isInteger(b) ||
    r < 0 ||
    r > 255 ||
    g < 0 ||
    g > 255 ||
    b < 0 ||
    b > 255
  ) {
    return null;
  }

  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function getMotionLineColor(userColorTheme) {
  return (
    cssColorToHex(userColorTheme?.stroke) ||
    DEFAULT_MOTION_LINE_COLOR
  );
}

function MainApp({ system, authApi, accountsApi, user, setUser }) {
  const navigate = useNavigate();

  const allRuntime = useAllRuntime();
  const global = allRuntime.global;
  const engineRuntime = global.schema?.engineKey
    ? allRuntime[global.schema.engineKey]
    : {};
  const runtime = {
    ...global,
    ...engineRuntime,
    apis: {
      ...global.apis,
      ...(engineRuntime.apis || {}),
    },
  };

  const engine = runtime.schema?.engineKey
    ? getEngine(runtime.schema.engineKey)
    : null;

  function updateSchemaMetadata(diffs = {}) {
    runtime.setSchema((prev) => {
      if (!prev) return prev;
      return applySchemaMetadataDiffs(prev, diffs);
    });
  }

  // ─────────────────────────────────────────────
  // 1. Load Lightweight Owned Projects (once) + Auto-create default if none exist
  // ─────────────────────────────────────────────
  useEffect(() => {
    const loadProjects = async () => {
      if (runtime.projects !== null) return;
      system.startLoading("Loading Projects...");

      try {
        const [
          { data: newProjectList, message },
          { data: newSharedProjectList, message: sharedMessage },
          { data: newFavouriteProjectList, message: favouriteMessage },
        ] = await Promise.all([
          runtime.apis.projectApi.getProjects(),
          runtime.apis.projectApi.getSharedProjects(),
          runtime.apis.usersApi.getFavouriteProjects(),
        ]);

        system.notify(message);
        system.notify(sharedMessage);
        system.notify(favouriteMessage);
        runtime.setSharedProjects(
          Array.isArray(newSharedProjectList) ? newSharedProjectList : [],
        );
        runtime.setFavouriteProjects(
          Array.isArray(newFavouriteProjectList) ? newFavouriteProjectList : [],
        );

        if (!newProjectList || newProjectList.length === 0) {
          const payload = {
            engineKey: "places",
            projectName: "City Places",
            projectDescription: "",
            projectTags: [],
            visibility: "private",
          };

          const { data: newProjectData, message: createMsg } =
            await runtime.apis.projectApi.add(payload);

          system.notify(createMsg);

          if (!newProjectData?._id) {
            return;
          }

          const newMetaProject = {
            _id: newProjectData._id,
            projectName: payload.projectName,
            projectDescription: payload.projectDescription,
            projectTags: Array.isArray(payload.projectTags)
              ? payload.projectTags
              : [],
            engineKey: payload.engineKey,
            userRole: "owner",
            visibility: "private",
            owner: user?.userName || "",
            ownerColorTheme: user?.userColorTheme || "green",
          };

          runtime.setProjects([newMetaProject]);
          runtime.setProjectId(newProjectData._id);
          localStorage.setItem(LAST_PROJECT_KEY, newProjectData._id);
        } else {
          runtime.setProjects(newProjectList);

          const savedProjectId = localStorage.getItem(LAST_PROJECT_KEY);

          const savedProject =
            savedProjectId &&
            newProjectList.find(
              (p) => String(p._id) === String(savedProjectId),
            );

          const defaultProject =
            savedProject ||
            newProjectList.find((p) => p.projectName === "default") ||
            newProjectList[0];

          if (defaultProject?._id) {
            runtime.setProjectId(defaultProject._id);
          }
        }
      } catch {
        system.notify("Project load failed.");
      } finally {
        system.stopLoading?.();
      }
    };

    loadProjects();
  }, []);

  // ─────────────────────────────────────────────
  // 2. Load Schema When Project Changes and remove active user doc form presence engine if applicable
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!runtime.projectId) return;

    localStorage.setItem(LAST_PROJECT_KEY, runtime.projectId);

    const loadSchema = async () => {
      try {
        if (runtime.schema?.engineKey === "presence") {
          const activePresenceDoc = runtime.draftUserRef?.current || null;

          if (runtime.geoWatchIdRef?.current !== null) {
            navigator.geolocation.clearWatch(runtime.geoWatchIdRef.current);
            runtime.geoWatchIdRef.current = null;
          }

          runtime.setTrackLocation(false);
          runtime.setUserLocation(null);
          runtime.setDraftUser?.(null);

          if (runtime.draftUserRef) {
            runtime.draftUserRef.current = null;
          }

          runtime.setSelectedDataItem?.(null);

          if (activePresenceDoc?._id) {
            runtime.dataUtils?.removeDataItemFromList?.(
              runtime.setData,
              activePresenceDoc._id,
            );

            try {
              await runtime.apis.engineApi.remove(
                activePresenceDoc._id,
                runtime.schema._id,
              );
            } catch {
              system.notify("Failed to clean up active presence.");
            }
          }
        }

        const { data: apiResponse, message } =
          await runtime.apis.projectApi.getProject(runtime.projectId);

        system.notify(message);

        if (!apiResponse) {
          return;
        }

        runtime.setSchema(apiResponse);
      } catch {
        system.stopLoading?.();
        system.notify("Schema load failed.");
      }
    };

    loadSchema();
  }, [runtime.projectId, runtime.projects]);

  // ─────────────────────────────────────────────
  // 3. Fetch Data
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (
      !runtime.schema ||
      !runtime.apis?.engineApi ||
      runtime.schema.engineKey === "presence"
    ) {
      return;
    }

    const fetchDocs = async () => {
      try {
        runtime.setData([]);
        runtime.setFilteredData([]);
        runtime.setSelectedDataItem(null);

        const { data: apiResponse, message } =
          await runtime.apis.engineApi.getAll(runtime.schema._id);

        system.notify(message);

        const normalized = runtime.dataUtils.normalizeData(
          runtime.schema,
          apiResponse || [],
        );

        runtime.setData(normalized);
        runtime.setFilteredData(normalized);
        runtime.map.fitToData(normalized);
      } catch {
        system.notify("Failed to fetch data.");
      } finally {
        system.stopLoading();
      }
    };

    fetchDocs();
  }, [runtime.schema?._id, runtime.schema?.configUpdatedAt]);

  // ─────────────────────────────────────────────
  // 3b. Fetch Layers
  // ─────────────────────────────────────────────
  /*
   * Loaded once per project load, same trigger as "Fetch Data" above -
   * not on every visit to the Layers page (src/workflows/Layers.jsx
   * used to call loadLayers itself on mount, which is what caused a
   * notification cascade: its dependency array included `system`, and
   * SystemProvider's own context value is a new object every time its
   * toast list changes (see SystemProvider.jsx's own `value` useMemo),
   * so system.notify("Layers retrieved") firing inside the effect
   * changed `system`'s identity, which retriggered the same effect,
   * which notified again, forever. `system` must never be a useEffect
   * dependency for exactly this reason - call it freely inside an
   * effect's body, same as every other effect in this file already
   * does, but never list it in the dependency array).
   *
   * Layers don't need refetching on create/update/delete - those
   * handlers (src/runtime/useSpatialToolsRuntime.js) already patch
   * runtime.layers directly from each API response.
   *
   * Every engine has these three now, so there is no engine check
   * here - the typeof guards are only for a runtime that has not
   * finished composing yet.
   */
  useEffect(() => {
    if (typeof runtime.loadLayers !== "function") return;
    if (!runtime.schema?._id) return;

    runtime.loadLayers(runtime.schema._id, system);
  }, [runtime.schema?._id, runtime.schema?.configUpdatedAt]);

  // ─────────────────────────────────────────────
  // 3c. Fetch Aggregates + Boundaries
  // ─────────────────────────────────────────────
  /*
   * Same "load once per project, never as a side effect of visiting
   * the page, never with `system` in the dependency array" pattern as
   * 3b above - see that effect's own comment for the notification-
   * cascade bug this avoids repeating.
   */
  useEffect(() => {
    if (typeof runtime.loadAggregates !== "function") return;
    if (!runtime.schema?._id) return;

    runtime.loadAggregates(runtime.schema._id, system);
  }, [runtime.schema?._id, runtime.schema?.configUpdatedAt]);

  useEffect(() => {
    if (typeof runtime.loadBoundaries !== "function") return;
    if (!runtime.schema?._id) return;

    runtime.loadBoundaries(runtime.schema._id, system);
  }, [runtime.schema?._id, runtime.schema?.configUpdatedAt]);

  // ─────────────────────────────────────────────
  // 3. Fetch Data (Presence polling version)
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!runtime.schema || !runtime.apis?.engineApi) return;
    if (runtime.schema.engineKey !== "presence") return;

    let intervalId = null;
    let pollingStopped = false;

    const buildValidatedSchemaMetadata = () => {
      const schemaMetadata = buildPresenceSchemaMetadata(runtime.schema);

      const validation = validatePresenceSchemaMetadata(
        schemaMetadata,
        runtime.schema._id,
      );

      if (!validation.isValid) {
        return {
          schemaMetadata: null,
          error: validation.error || "Invalid presence schema metadata.",
        };
      }

      return {
        schemaMetadata,
        error: null,
      };
    };

    const clearPresenceData = () => {
      runtime.setData([]);
      runtime.setFilteredData([]);
      runtime.setSelectedDataItem(null);
    };

    const stopPolling = () => {
      pollingStopped = true;

      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const applyPresenceSchemaDiffs = (apiResponse) => {
      updateSchemaMetadata({
        schemaUpdatedAt: apiResponse?.schemaUpdatedAt ?? null,
        addedCustomTags: apiResponse?.addedCustomTags || [],
        removedCustomTags: apiResponse?.removedCustomTags || [],
        addedCustomCategories: apiResponse?.addedCustomCategories || [],
        removedCustomCategories: apiResponse?.removedCustomCategories || [],
        addedCustomUnits: apiResponse?.addedCustomUnits || [],
        removedCustomUnits: apiResponse?.removedCustomUnits || [],
      });
    };

    const fetchInitialDocs = async () => {
      try {
        clearPresenceData();

        const { schemaMetadata, error } = buildValidatedSchemaMetadata();

        if (error) {
          stopPolling();
          system.notify(error);
          return;
        }

        const { data: apiResponse } = await runtime.apis.engineApi.getAll(
          runtime.schema._id,
          schemaMetadata,
        );

        if (pollingStopped) return;

        applyPresenceSchemaDiffs(apiResponse);

        const normalized = runtime.dataUtils.normalizeData(
          runtime.schema,
          apiResponse?.data || [],
        );

        runtime.setData(normalized);
        runtime.setFilteredData(normalized);
        runtime.map.fitToData(normalized);
      } catch {
        clearPresenceData();
        stopPolling();
        system.notify("Failed to fetch presence data. Reload may be required.");
      } finally {
        system.stopLoading();
      }
    };

    const pollDocs = async () => {
      if (pollingStopped) return;

      try {
        const { schemaMetadata, error } = buildValidatedSchemaMetadata();

        if (error) {
          clearPresenceData();
          stopPolling();
          system.notify(error);
          return;
        }

        const { data: apiResponse } = await runtime.apis.engineApi.getAll(
          runtime.schema._id,
          schemaMetadata,
        );

        if (pollingStopped) return;

        applyPresenceSchemaDiffs(apiResponse);

        const normalized = runtime.dataUtils.normalizeData(
          runtime.schema,
          apiResponse?.data || [],
        );

        runtime.setData(normalized);
        runtime.setFilteredData(normalized);
      } catch {
        clearPresenceData();
        stopPolling();
        system.notify(
          "Presence data stopped refreshing. Reload may be required.",
        );
      }
    };

    fetchInitialDocs();

    intervalId = setInterval(pollDocs, 5000);

    return () => {
      stopPolling();
    };
  }, [runtime.schema?._id, runtime.schema?.configUpdatedAt]);

  // ─────────────────────────────────────────────
  // 4. sync draft user ref when draftUser user changes.
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (runtime.schema?.engineKey !== "presence") return;
    if (!runtime.draftUserRef) return;

    runtime.draftUserRef.current = runtime.draftUser;
  }, [runtime.schema?._id, runtime.draftUser, runtime.draftUserRef]);

  // ─────────────────────────────────────────────
  // 5. Track Location Mode
  // ─────────────────────────────────────────────
  useEffect(() => {
    const isPresenceEngine = runtime.schema?.engineKey === "presence";
    const isMotionEngine = runtime.schema?.engineKey === "motion";

    const MOTION_SAMPLE_INTERVAL_MS = 5000;

    let motionSampleIntervalId = null;
    let latestMotionCoords = null;
    let lastMotionSampleMs = 0;

    const clearMotionSampleInterval = () => {
      if (motionSampleIntervalId !== null) {
        clearInterval(motionSampleIntervalId);
        motionSampleIntervalId = null;
      }
    };

    const appendMotionSampleFromLatest = ({
      timestampMs = Date.now(),
      force = false,
    } = {}) => {
      if (!latestMotionCoords) return;

      if (
        !force &&
        lastMotionSampleMs > 0 &&
        timestampMs - lastMotionSampleMs < MOTION_SAMPLE_INTERVAL_MS
      ) {
        return;
      }

      lastMotionSampleMs = timestampMs;

      runtime.appendMotionSample?.({
        lat: latestMotionCoords.lat,
        lng: latestMotionCoords.lng,
        timestampISO: new Date(timestampMs).toISOString(),
      });
    };

    const clearGeoWatch = () => {
      clearMotionSampleInterval();

      if (runtime.geoWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(runtime.geoWatchIdRef.current);
        runtime.geoWatchIdRef.current = null;
      }
    };

    const removePresenceDoc = async () => {
      if (!isPresenceEngine || !runtime.schema?._id) {
        return false;
      }

      const activeDraftUser = runtime.draftUserRef.current;

      if (!activeDraftUser?._id) {
        runtime.setDraftUser(null);
        runtime.draftUserRef.current = null;
        return true;
      }

      const removingId = activeDraftUser._id;

      const { data: apiResponse, message } =
        await runtime.apis.engineApi.remove(removingId, runtime.schema._id);

      if (message) {
        system.notify(message);
      }

      if (!apiResponse?.data?._id) {
        return false;
      }

      updateSchemaMetadata({
        schemaUpdatedAt: apiResponse?.schemaUpdatedAt ?? null,
        addedCustomTags: apiResponse?.addedCustomTags || [],
        removedCustomTags: apiResponse?.removedCustomTags || [],
        addedCustomCategories: apiResponse?.addedCustomCategories || [],
        removedCustomCategories: apiResponse?.removedCustomCategories || [],
        addedCustomUnits: apiResponse?.addedCustomUnits || [],
        removedCustomUnits: apiResponse?.removedCustomUnits || [],
      });

      runtime.setDraftUser(null);
      runtime.draftUserRef.current = null;
      runtime.setSelectedDataItem?.(null);
      runtime.dataUtils.removeDataItemFromList(runtime.setData, removingId);

      return true;
    };

    const abortPresenceTracking = (message) => {
      clearGeoWatch();
      runtime.setDraftUser(null);
      runtime.draftUserRef.current = null;
      runtime.setUserLocation(null);
      runtime.setTrackLocation(false);

      if (message) {
        system.notify(message);
      }
    };

    const saveCompletedMotionRecord = async () => {
  if (!isMotionEngine) {
    return true;
  }

  const samples =
    runtime.motionSamplesRef?.current || [];

  if (samples.length < 2) {
    runtime.clearMotionSamples?.();
    return true;
  }

  if (
    !runtime.schema?._id ||
    !runtime.schema?.updatedAt
  ) {
    runtime.clearMotionSamples?.();
    system.notify("Schema not loaded.");
    return false;
  }

  if (!runtime.blankFormTemplate) {
    runtime.clearMotionSamples?.();
    system.notify(
      "Motion form template not loaded.",
    );
    return false;
  }

  const workingForm =
    structuredClone(
      runtime.blankFormTemplate,
    );

  runtime.forms.injectLayer?.(
    workingForm,
    1,
    null,
  );

  runtime.forms.injectRequiredDefaults?.(
    workingForm,
    runtime.schema,
  );

  const motionGeometry = sanitizeLineStringGeometry({
    type: "LineString",
    coordinates: samples.map(
      (sample) => [
        sample.lng,
        sample.lat,
      ],
    ),
    lineColor: getMotionLineColor(
      runtime.userColorTheme,
    ),
  });

  if (!motionGeometry) {
    runtime.clearMotionSamples?.();

    system.notify(
      "Motion record geometry is invalid.",
    );

    return false;
  }

  const payload = {
    layer: 1,
    geometry: motionGeometry,
    time: {
      type: "Motion",
      mode: "Sampled",
      timezone:
        runtime.viewerTimeZone ||
        "Etc/UTC",
      samples: samples.map(
        (sample) => ({
          lat: sample.lat,
          lng: sample.lng,
          timestampISO:
            sample.timestampISO,
        }),
      ),
    },
    sections: workingForm.sections,
    extensions:
      workingForm.extensions || {},
  };

  const validation =
    validateDataItemPayload({
      schema: runtime.schema,
      dataItem: payload,
      mode: "add",
    });

  if (!validation.isValid) {
    runtime.clearMotionSamples?.();

    system.notify(
      validation.error ||
        "Motion record is missing required fields or contains invalid entries.",
    );

    return false;
  }

  const {
    data: apiResponse,
    message,
  } = await runtime.apis.engineApi.add(
    runtime.schema._id,
    runtime.schema.updatedAt,
    payload,
  );

  if (message) {
    system.notify(message);
  }

  if (!apiResponse?.data?._id) {
    runtime.clearMotionSamples?.();

    system.notify(
      message ||
        "Failed to save motion record.",
    );

    return false;
  }

  updateSchemaMetadata({
    schemaUpdatedAt:
      apiResponse?.schemaUpdatedAt ?? null,
    addedCustomTags:
      apiResponse?.addedCustomTags || [],
    removedCustomTags:
      apiResponse?.removedCustomTags || [],
    addedCustomCategories:
      apiResponse?.addedCustomCategories || [],
    removedCustomCategories:
      apiResponse?.removedCustomCategories || [],
    addedCustomUnits:
      apiResponse?.addedCustomUnits || [],
    removedCustomUnits:
      apiResponse?.removedCustomUnits || [],
  });

  const savedDocForClient = {
    ...apiResponse.data,
    userRole: "editor",
  };

  const normalizedDataItem =
    runtime.dataUtils.normalizeDataItem(
      runtime.schema,
      savedDocForClient,
    );

  runtime.dataUtils.insertDataItemInList(
    runtime.setData,
    normalizedDataItem,
  );

  runtime.setSelectedDataItem?.(
    normalizedDataItem,
  );

  runtime.clearMotionSamples?.();

  return true;
};

    if (!runtime.trackLocation) {
      const stopTracking = async () => {
        if (isMotionEngine) {
          clearGeoWatch();
          await saveCompletedMotionRecord();
          runtime.setUserLocation(null);
          return;
        }

        const removed = await removePresenceDoc();

        if (!isPresenceEngine || removed) {
          clearGeoWatch();
          runtime.setUserLocation(null);
        }
      };

      stopTracking();
      return;
    }

    runtime.geoWatchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));

        if (!isPresenceEngine && !isMotionEngine) {
          runtime.setUserLocation({ lat, lng });
          return;
        }

        if (isMotionEngine) {
          latestMotionCoords = { lat, lng };

          runtime.setUserLocation({ lat, lng });

          appendMotionSampleFromLatest({
            timestampMs: pos.timestamp || Date.now(),
            force: runtime.motionSamplesRef?.current?.length < 1,
          });

          return;
        }

        if (isPresenceEngine) {
          if (!runtime.schema?._id || !runtime.blankFormTemplate) {
            return;
          }

          try {
            const activeDraftUser = runtime.draftUserRef.current;

            if (!activeDraftUser?._id) {
              const workingForm = structuredClone(runtime.blankFormTemplate);

              runtime.forms.injectLayer?.(
                workingForm,
                runtime.activeLayer || 1,
                runtime.activeParentDataItemId || null,
              );

              if (workingForm.geometry?.type === "Point") {
                workingForm.geometry.coordinates = [lng, lat];
              }

              runtime.forms.injectCurrentDateTime?.(
                workingForm,
                runtime.schema,
              );

              runtime.forms.reapplyTimezoneFromLatLng?.(workingForm);

              runtime.forms.injectRequiredDefaults?.(
                workingForm,
                runtime.schema,
              );

              const payload =
                runtime.dataUtils.buildAddPayloadFromForm(workingForm);

              if (!payload) {
                abortPresenceTracking("Failed to start presence tracking.");
                return;
              }

              const validation = validateDataItemPayload({
                schema: runtime.schema,
                dataItem: payload,
                mode: "add",
              });

              if (!validation.isValid) {
                abortPresenceTracking(
                  "Form is missing required fields or contains invalid entries.",
                );
                return;
              }

              const { data: apiResponse, message } =
                await runtime.apis.engineApi.add(
                  runtime.schema._id,
                  runtime.schema.updatedAt,
                  payload,
                );

              if (message) {
                system.notify(message);
              }

              if (!apiResponse?._id) {
                abortPresenceTracking(
                  message || "Failed to start presence tracking.",
                );
                return;
              }

              const savedDoc = {
                ...payload,
                _id: apiResponse._id,
                userRole: "editor",
                userName: apiResponse.userName,
                userColorTheme: apiResponse.userColorTheme,
                createdAt: apiResponse.createdAt,
                updatedAt: apiResponse.updatedAt,
              };

              const normalizedDataItem = runtime.dataUtils.normalizeDataItem(
                runtime.schema,
                savedDoc,
              );

              runtime.setUserLocation({ lat, lng });
              runtime.draftUserRef.current = normalizedDataItem;
              runtime.setDraftUser(normalizedDataItem);

              runtime.dataUtils.insertDataItemInList(
                runtime.setData,
                normalizedDataItem,
              );

              runtime.setSelectedDataItem(normalizedDataItem);

              return;
            }

            const pingId = activeDraftUser._id;

            const { data: apiResponse, message } =
              await runtime.apis.engineApi.ping(pingId, runtime.schema._id, [
                lng,
                lat,
              ]);

            if (!apiResponse?._id) {
              abortPresenceTracking(
                message || "Failed to update live presence location.",
              );
              return;
            }

            const draftUserClone = structuredClone(activeDraftUser);

            if (draftUserClone.geometry?.type === "Point") {
              draftUserClone.geometry.coordinates = [lng, lat];
            }

            draftUserClone.time = structuredClone(
              apiResponse.time || draftUserClone.time,
            );

            draftUserClone.updatedAt = apiResponse.updatedAt;

            runtime.setUserLocation({ lat, lng });
            runtime.draftUserRef.current = draftUserClone;
            runtime.setDraftUser(draftUserClone);

            runtime.dataUtils.updateDataItemInList(
              runtime.setData,
              draftUserClone,
            );
          } catch {
            abortPresenceTracking("Presence tracking failed.");
          }

          return;
        }
      },
      () => {
        clearGeoWatch();
        runtime.setUserLocation(null);
        runtime.setTrackLocation(false);
        system.notify("Failed to start location tracking.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      },
    );

    if (isMotionEngine) {
      motionSampleIntervalId = setInterval(() => {
        appendMotionSampleFromLatest({
          timestampMs: Date.now(),
        });
      }, MOTION_SAMPLE_INTERVAL_MS);
    }

    return () => {
      clearGeoWatch();
    };
  }, [runtime.trackLocation, runtime.schema?._id]);

  // ─────────────────────────────────────────────
  // 6. Page Switching on engine changes
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!runtime.schema?.engineKey) return;

    if (
      runtime.schema?.engineKey !== "neighbourhoods" &&
      runtime.currentPage === "analysis"
    ) {
      navigate("/app/viewer", { replace: true });
    }
  }, [runtime.schema?.engineKey, runtime.currentPage]);

  // ─────────────────────────────────────────────
  // 7. Sync local user color theme
  // ─────────────────────────────────────────────
  useEffect(() => {
    const resolvedTheme =
      runtime.USER_ICON_THEMES[user?.userColorTheme] ||
      runtime.USER_ICON_THEMES.green;

    runtime.setUserColorTheme(resolvedTheme);
  }, [user?.userColorTheme]);

  // ─────────────────────────────────────────────
  // 8. Stop Presence Tracking When Tab Becomes Hidden
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (runtime.schema?.engineKey !== "presence") return;
    if (!runtime.trackLocation) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        runtime.setTrackLocation(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    runtime.schema?._id,
    runtime.trackLocation,
    runtime.schema?.configUpdatedAt,
  ]);

  // ─────────────────────────────────────────────
  // APP RENDER
  // ─────────────────────────────────────────────
  /*
   * True only while a page that actually displays the map (viewer/
   * editor-type engine pages) is current. Used to hide (not unmount)
   * MapShellHost below - the map shell is meant to be session-
   * persistent (see MapShellHost.jsx / MapboxMapShell.jsx's own
   * comments), so this must stay a visibility toggle, never a mount
   * condition, or navigating to projects/community/profile/schema/
   * account tears down and rebuilds the live mapboxgl.Map instance on
   * every trip, which is both wasteful and (its layers imperatively
   * call map.getLayer/removeLayer on unmount) a real crash risk if
   * that teardown races the map's own async construction or a style
   * reload.
   */
  const isMapPageActive =
    runtime.currentPage !== "projects" &&
    runtime.currentPage !== "community" &&
    runtime.currentPage !== "profile" &&
    runtime.currentPage !== "schema" &&
    runtime.currentPage !== "account" &&
    /*
     * Insights is a dashboard, not a map view - it is the one spatial
     * tool page that displays no map at all.
     */
    runtime.currentPage !== "insights" &&
    runtime.forms;

  return (
    <div className="app-container">
      <Header
        pagesConfig={engine?.getPagesConfig?.(runtime.schema?.userRole) || []}
        hasAdminClearance={runtime.hasAdminClearance}
        authApi={authApi}
        system={system}
        engineApi={runtime.apis.engineApi}
        schema={runtime.schema}
        draftUser={runtime.draftUser}
      />

      <div className="main-layer">
        <MapShellHost
          runtime={runtime}
          system={system}
          engine={engine}
          hidden={!isMapPageActive}
        />

        {isMapPageActive && (
          <>
              <ProjectTitle projectName={runtime.schema.projectName} />

              <SettingsToggle
                isSettingsModalOpen={runtime.isSettingsModalOpen}
                setIsSettingsModalOpen={runtime.setIsSettingsModalOpen}
                isMobile={runtime.isMobile}
                system={system}
              />
              <SettingsModal
                isSettingsModalOpen={runtime.isSettingsModalOpen}
                setIsSettingsModalOpen={runtime.setIsSettingsModalOpen}
                projects={runtime.projects}
                setProjectId={runtime.setProjectId}
                projectId={runtime.projectId}
                setSelectedDataItem={runtime.setSelectedDataItem}
                tileStyleKey={runtime.tileStyleKey}
                setTileStyleKey={runtime.setTileStyleKey}
                TILE_STYLES={runtime.TILE_STYLES}
                system={system}
                schema={runtime.schema}
                user={user}
                setUser={setUser}
                accountsApi={accountsApi}
                USER_ICON_THEMES={runtime.USER_ICON_THEMES}
              />

              {engine && runtime.schema && (
                <engine.AppAdapter runtime={runtime} system={system} />
              )}

              {runtime.activeExtensionModal &&
                engine?.extensionModals?.[runtime.activeExtensionModal.key] &&
                (() => {
                  const ExtensionModal =
                    engine.extensionModals[runtime.activeExtensionModal.key];

                  return (
                    <ExtensionModal
                      isOpen={true}
                      onClose={() => runtime.setActiveExtensionModal(null)}
                      mode={runtime.activeExtensionModal.mode}
                      selectedDataItem={runtime.selectedDataItem}
                      schema={runtime.schema}
                      system={system}
                      extensionsApi={runtime.apis.extensionsApi}
                      isMobile={runtime.isMobile}
                      user={user}
                    />
                  );
                })()}
            </>
          )}

        <Routes>
          <Route index element={<Navigate to="projects" replace />} />
          {engine && runtime.schema && (
            <>
              <Route
                path="projects"
                element={
                  <Projects
                    setCurrentPage={runtime.setCurrentPage}
                    system={system}
                    apis={runtime.apis}
                    schema={runtime.schema}
                    setSchema={runtime.setSchema}
                    projectId={runtime.projectId}
                    setProjectId={runtime.setProjectId}
                    projectName={runtime.projectName}
                    projects={runtime.projects}
                    setProjects={runtime.setProjects}
                    favouriteProjects={runtime.favouriteProjects}
                    setFavouriteProjects={runtime.setFavouriteProjects}
                    user={user}
                    setUser={setUser}
                  />
                }
              />

              <Route
                path="community"
                element={
                  <Community
                    setCurrentPage={runtime.setCurrentPage}
                    system={system}
                    schema={runtime.schema}
                    setSchema={runtime.setSchema}
                    projectId={runtime.projectId}
                    setProjectId={runtime.setProjectId}
                    projects={runtime.projects}
                    setProjects={runtime.setProjects}
                    publicProjects={runtime.publicProjects}
                    setPublicProjects={runtime.setPublicProjects}
                    sharedProjects={runtime.sharedProjects}
                    setSharedProjects={runtime.setSharedProjects}
                    favouriteProjects={runtime.favouriteProjects}
                    setFavouriteProjects={runtime.setFavouriteProjects}
                    apis={runtime.apis}
                    user={user}
                    setUser={setUser}
                  />
                }
              />

            </>
          )}

          {runtime.schema &&
            engine &&
            runtime.forms &&
            engine.PagesAdapter?.({ runtime, system })}

          {engine && runtime.schema && (
            <>
              <Route
                path="schema"
                element={
                  runtime.hasAdminClearance ? (
                    <Schema
                      setCurrentPage={runtime.setCurrentPage}
                      system={system}
                      apis={runtime.apis}
                      schema={runtime.schema}
                      setSchema={runtime.setSchema}
                      projectId={runtime.projectId}
                      setProjectId={runtime.setProjectId}
                      setProjects={runtime.setProjects}
                    />
                  ) : (
                    <Navigate to="/app/viewer" replace />
                  )
                }
              />

              <Route
                path="profile"
                element={
                  <MyProfile
                    setCurrentPage={runtime.setCurrentPage}
                    system={system}
                    apis={runtime.apis}
                    setSchema={runtime.setSchema}
                    projectId={runtime.projectId}
                    setProjectId={runtime.setProjectId}
                    projects={runtime.projects}
                    setProjects={runtime.setProjects}
                    setSharedProjects={runtime.setSharedProjects}
                    favouriteProjects={runtime.favouriteProjects}
                    setFavouriteProjects={runtime.setFavouriteProjects}
                    user={user}
                    setUser={setUser}
                  />
                }
              />
            </>
          )}

          <Route
            path="account"
            element={
              <Account
                setCurrentPage={runtime.setCurrentPage}
                system={system}
                accountsApi={accountsApi}
                apis={runtime.apis}
                user={user}
                setUser={setUser}
                USER_ICON_THEMES={runtime.USER_ICON_THEMES}
              />
            }
          />
        </Routes>
      </div>
    </div>
  );
}

export default MainApp;
