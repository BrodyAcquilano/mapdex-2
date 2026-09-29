// src/map/mapbox/utils/useMapboxMap.js

import { useEffect, useRef, useState } from "react";
import * as mapboxgl from "mapbox-gl/esm";

import "mapbox-gl/dist/mapbox-gl.css";

// Give up waiting for the container to have a real size after this
// many animation frames (~0.5s at 60fps) and initialize anyway,
// rather than never rendering a map at all in some edge case.
const MAX_MEASURE_ATTEMPTS = 30;

/*
 * Creates and owns the underlying Mapbox GL map instance for the app's
 * one map panel - called once, handing the returned map instance to
 * its layer(s) and to the shared mapbox controller components
 * (MapViewTracker, MapActionController, VisibilityController).
 */
const DEFAULT_STYLE_URL = "mapbox://styles/mapbox/standard";
const DEFAULT_PROJECTION = "globe";
const DEFAULT_MIN_ZOOM = 0;
const DEFAULT_MAX_ZOOM = 22;

/*
 * Mapbox's own elevation tileset - a raster-dem source is required by
 * setTerrain() regardless of which visual style is draped over it.
 */
const DEM_SOURCE_ID = "mapdex-mapbox-dem";
const DEM_SOURCE_URL = "mapbox://mapbox.mapbox-terrain-dem-v1";

/*
 * Adds (once) the raster-dem source setTerrain() needs and turns
 * terrain on, or turns it off, on the given map instance. setStyle()
 * wipes runtime-added sources the same way it wipes layers, so - like
 * every Mapbox layer file's own sources - this needs re-adding after
 * every style reload, not just once at construction.
 */
function applyTerrain(mapInstance, enabled, exaggeration) {
  if (!enabled) {
    mapInstance.setTerrain(null);
    return;
  }

  if (!mapInstance.getSource(DEM_SOURCE_ID)) {
    mapInstance.addSource(DEM_SOURCE_ID, {
      type: "raster-dem",
      url: DEM_SOURCE_URL,
      tileSize: 512,
      maxzoom: 14,
    });
  }

  mapInstance.setTerrain({
    source: DEM_SOURCE_ID,
    exaggeration: Number.isFinite(exaggeration) ? exaggeration : 1,
  });
}

export function useMapboxMap({
  mapCenter,
  mapZoom,
  DEFAULT_EMPTY_CENTER,
  DEFAULT_EMPTY_ZOOM,
  mapboxStyleUrl = DEFAULT_STYLE_URL,
  mapboxProjection = DEFAULT_PROJECTION,
  mapboxMinZoom = DEFAULT_MIN_ZOOM,
  mapboxMaxZoom = DEFAULT_MAX_ZOOM,
  mapboxLightPreset = null,
  mapboxTerrain = false,
  mapboxTerrainExaggeration = 1,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const handleLoadRef = useRef(null);

  /*
   * The style/projection/zoom limits actually applied to the live map
   * instance, so the reactive style-swap effect below can tell "the
   * style prop changed" apart from "this is just the initial mount
   * render" without depending on the mapboxMap state value itself
   * (see that effect's comment for why that distinction matters).
   */
  const appliedStyleRef = useRef(null);

  const [mapboxMap, setMapboxMap] = useState(null);

  /*
   * Mount effect: constructs the map exactly once. Deliberately does
   * NOT depend on the style/projection/zoom props - changing those
   * after mount is handled by the reactive effect below via
   * setStyle() on the existing instance, rather than by tearing down
   * and recreating the whole mapboxgl.Map (each `new mapboxgl.Map()`
   * counts as a distinct "map load" for Mapbox's billing, so
   * recreating on every style switch would burn quota for no reason).
   */
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    const accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

    if (!accessToken) {
      console.error("Missing VITE_MAPBOX_ACCESS_TOKEN.");
      return;
    }

    let cancelled = false;
    let rafId = null;

    const createMap = () => {
      const container = mapContainerRef.current;

      if (!container || cancelled) return;

      const initialCenter =
        Array.isArray(mapCenter) && mapCenter.length === 2
          ? mapCenter
          : DEFAULT_EMPTY_CENTER;

      const initialZoom = Number.isFinite(mapZoom)
        ? mapZoom
        : DEFAULT_EMPTY_ZOOM;

      /*
       * Mapdex stores map center as [lat, lng].
       * Mapbox expects [lng, lat].
       */
      const initialLat = Number(initialCenter?.[0]) || 0;
      const initialLng = Number(initialCenter?.[1]) || 0;

      const mapInstance = new mapboxgl.Map({
        accessToken,

        container,

        style: mapboxStyleUrl,

        projection: mapboxProjection,

        center: [initialLng, initialLat],

        zoom: initialZoom,

        minZoom: mapboxMinZoom,

        maxZoom: mapboxMaxZoom,

        pitch: 45,

        bearing: 0,

        attributionControl: true,
      });

      mapRef.current = mapInstance;

      appliedStyleRef.current = {
        url: mapboxStyleUrl,
        projection: mapboxProjection,
        minZoom: mapboxMinZoom,
        maxZoom: mapboxMaxZoom,
        lightPreset: mapboxLightPreset,
        terrain: mapboxTerrain,
        terrainExaggeration: mapboxTerrainExaggeration,
      };

      const handleLoad = () => {
        /*
         * lightPreset isn't a constructor option - Standard/Standard
         * Satellite's own dynamic lighting is a runtime config
         * property on the style's "basemap" import, only settable
         * once the style has actually loaded.
         */
        if (mapboxLightPreset) {
          mapInstance.setConfigProperty(
            "basemap",
            "lightPreset",
            mapboxLightPreset,
          );
        }

        applyTerrain(mapInstance, mapboxTerrain, mapboxTerrainExaggeration);

        setMapboxMap(mapInstance);
      };

      handleLoadRef.current = handleLoad;
      mapInstance.on("load", handleLoad);
    };

    /*
     * Mapbox GL measures its container's size exactly once, at
     * construction, and (in this version) never re-measures on its
     * own afterward - only an actual window resize/orientationchange
     * event makes it re-check. If the container reports a 0x0 rect
     * because our flex/vh-based layout hasn't finished settling yet,
     * Mapbox silently falls back to a hardcoded 400x300 canvas and
     * never corrects itself, which is what produced a blank map on a
     * plain desktop load (shrinking the window to test "mobile" just
     * happened to fire the resize event that fixed it).
     *
     * So: wait until the container actually has a measurable size
     * before constructing the map at all, rather than constructing it
     * immediately and hoping the layout has already settled.
     */
    const waitForMeasurableContainer = (attempt = 0) => {
      if (cancelled) return;

      const container = mapContainerRef.current;

      if (!container) return;

      const rect = container.getBoundingClientRect();
      const isMeasurable = rect.width > 0 && rect.height > 0;

      if (isMeasurable || attempt >= MAX_MEASURE_ATTEMPTS) {
        createMap();
        return;
      }

      rafId = requestAnimationFrame(() =>
        waitForMeasurableContainer(attempt + 1),
      );
    };

    rafId = requestAnimationFrame(() => waitForMeasurableContainer());

    return () => {
      cancelled = true;

      if (rafId) {
        cancelAnimationFrame(rafId);
      }

      const mapInstance = mapRef.current;

      if (mapInstance) {
        if (handleLoadRef.current) {
          mapInstance.off("load", handleLoadRef.current);
        }

        mapInstance.remove();
      }

      mapRef.current = null;
      appliedStyleRef.current = null;
      handleLoadRef.current = null;
      setMapboxMap(null);
    };
    /*
     * Deliberately mount-once (empty deps). mapCenter/mapZoom/
     * DEFAULT_EMPTY_CENTER/DEFAULT_EMPTY_ZOOM are only meant to seed
     * where a brand-new map starts (e.g. switching from Leaflet to
     * Mapbox should pick up wherever Leaflet was left, not jump
     * anywhere), never to recreate the map on every pan/zoom.
     * mapboxStyleUrl/mapboxProjection/mapboxMinZoom/mapboxMaxZoom/
     * mapboxLightPreset only seed the map's INITIAL style the same
     * way - later changes to them are handled by the reactive effect
     * below, which calls setStyle() on this same instance instead of
     * tearing it down and reconstructing a new one.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Reactive style swap: applies a later style/projection/zoom-limit
   * change to the EXISTING map instance via setStyle() rather than
   * recreating it, since every `new mapboxgl.Map()` construction
   * counts as a separate "map load" for Mapbox's billing - switching
   * styles is expected to be a cheap, frequent action (Settings
   * modal), not something that should cost a load every time.
   *
   * This deliberately does NOT depend on the mapboxMap state value:
   * that value flips from null to the instance asynchronously (once
   * Mapbox's own "load" event fires), and including it here would
   * make this effect re-run at that moment too, racing the
   * appliedStyleRef assignment made inside createMap() above. Reading
   * mapRef.current directly and comparing against appliedStyleRef
   * means this only ever does real work when one of the style props
   * has genuinely changed after mount - on the initial mount render
   * (before the map has finished constructing) mapRef.current is
   * still null and this is a no-op; once the map exists,
   * appliedStyleRef already matches whatever it was constructed with,
   * so it stays a no-op until an actual style change happens.
   *
   * setStyle() does not touch the map's own camera (center/zoom/
   * pitch/bearing) - that's owned by the map's transform, not the
   * style - so switching styles this way never moves or re-zooms the
   * view out from under the user.
   *
   * Every Mapbox layer component (GeometryLayer, DrawLayer, etc.)
   * re-adds its own custom sources/layers via the map's native
   * "style.load" event, which setStyle() triggers once the new style
   * has finished loading - see those files for that mechanism. It's
   * a plain mapboxgl event listener, not React state, so no
   * additional signal is needed from here for that to work.
   */
  useEffect(() => {
    const mapInstance = mapRef.current;

    if (!mapInstance) return;

    const applied = appliedStyleRef.current;

    /*
     * Split apart because toggling day/night, terrain, or the 2D/3D
     * projection override (MapboxTerrainToggles.jsx/MapStyleToggle.jsx)
     * never changes styleUrl - there is no style reload to wait for,
     * so all three need to be applied directly and immediately rather
     * than queued for a "style.load" that may never fire (setStyle()
     * with an unchanged URL is a no-op). Projection specifically is
     * its own mapboxgl.Map method (setProjection()) independent of
     * setStyle() entirely - Brody's own call to apply it this way
     * rather than folding it into styleChanged (an earlier version
     * did), since forcing a full style reload just to flip between a
     * style's own default projection and its 2D override was needless
     * - every Mapbox layer file re-adds its own sources/layers on
     * "style.load", which never fires for a plain setProjection() call.
     */
    const styleChanged =
      !applied ||
      applied.url !== mapboxStyleUrl ||
      applied.minZoom !== mapboxMinZoom ||
      applied.maxZoom !== mapboxMaxZoom;

    const projectionChanged = !applied || applied.projection !== mapboxProjection;

    const lightPresetChanged = !applied || applied.lightPreset !== mapboxLightPreset;

    const terrainChanged =
      !applied ||
      applied.terrain !== mapboxTerrain ||
      applied.terrainExaggeration !== mapboxTerrainExaggeration;

    if (!styleChanged && !projectionChanged && !lightPresetChanged && !terrainChanged) return;

    appliedStyleRef.current = {
      url: mapboxStyleUrl,
      projection: mapboxProjection,
      minZoom: mapboxMinZoom,
      maxZoom: mapboxMaxZoom,
      lightPreset: mapboxLightPreset,
      terrain: mapboxTerrain,
      terrainExaggeration: mapboxTerrainExaggeration,
    };

    if (styleChanged) {
      mapInstance.setStyle(mapboxStyleUrl);
      mapInstance.setProjection(mapboxProjection);
      mapInstance.setMinZoom(mapboxMinZoom);
      mapInstance.setMaxZoom(mapboxMaxZoom);

      /*
       * Every style currently shares the same 0-22 range, so this is
       * a no-op today, but styles are allowed to carry their own
       * minZoom/maxZoom (see GlobalRuntime.jsx) and nothing
       * guarantees that stays true - a style with a narrower range
       * than the one just left could leave the camera stuck beyond
       * its new limit. Explicit clamping here, rather than trusting
       * setMinZoom/setMaxZoom to move the camera on their own, is a
       * deliberate safeguard rather than an assumption.
       */
      const currentZoom = mapInstance.getZoom();

      if (currentZoom > mapboxMaxZoom) {
        mapInstance.setZoom(mapboxMaxZoom);
      } else if (currentZoom < mapboxMinZoom) {
        mapInstance.setZoom(mapboxMinZoom);
      }

      mapInstance.once("style.load", () => {
        if (mapboxLightPreset) {
          mapInstance.setConfigProperty(
            "basemap",
            "lightPreset",
            mapboxLightPreset,
          );
        }

        applyTerrain(mapInstance, mapboxTerrain, mapboxTerrainExaggeration);
      });
    } else {
      // The style itself is unchanged - apply directly, no reload to wait for.
      if (projectionChanged) {
        mapInstance.setProjection(mapboxProjection);

        /*
         * Pitch/bearing have no meaning on a flat, non-globe/mercator
         * projection (equalEarth included) - Mapbox doesn't clamp
         * these on its own, so an in-progress 3D tilt would otherwise
         * carry over unchanged into a 2D view. Eased rather than
         * snapped so the switch reads as an intentional transition,
         * not a jump cut - and only driven off whether the NEW
         * projection is globe, so toggling back to 3D restores the
         * same tilt every globe style already starts at, rather than
         * whatever arbitrary pitch happened to be set right before.
         */
        mapInstance.easeTo({
          pitch: mapboxProjection === "globe" ? 45 : 0,
          bearing: 0,
          duration: 300,
        });
      }

      if (lightPresetChanged && mapboxLightPreset) {
        mapInstance.setConfigProperty(
          "basemap",
          "lightPreset",
          mapboxLightPreset,
        );
      }

      if (terrainChanged) {
        applyTerrain(mapInstance, mapboxTerrain, mapboxTerrainExaggeration);
      }
    }
  }, [
    mapboxStyleUrl,
    mapboxProjection,
    mapboxMinZoom,
    mapboxMaxZoom,
    mapboxLightPreset,
    mapboxTerrain,
    mapboxTerrainExaggeration,
  ]);

  return { mapContainerRef, mapboxMap };
}
