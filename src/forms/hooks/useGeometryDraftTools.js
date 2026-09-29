// src/forms/hooks/useGeometryDraftTools.js

import { useCallback } from "react";

import {
  canFinishDraftGeometry,
  completeDraftGeometry,
} from "../../map/utils/draftGeometry.js";
import { isSingleCollapseAllowed } from "../../../shared/validation/geometryTypeRules.js";
import { validateGeometryPayload } from "../../../shared/validation/dataValidation.js";

/*
 * The Editor page's own draw and geometry-edit tools' finish handlers.
 * Hooks rather than plain helpers because they close over the
 * in-progress draftGeometry the map mutates as the user clicks and
 * drags.
 *
 * Filed under src/forms/ rather than src/map/ by what they ultimately
 * produce, not what they touch (Brody's own rule): these exist to put
 * geometry into a data item's form. The boundary equivalents live in
 * src/boundaries/hooks/ for the same reason, and genuinely map-only
 * concerns - camera moves, map controls that feed no draft - belong in
 * src/map/hooks/.
 *
 * Both engine runtimes (Places/Events) held identical copies inline.
 */
export function useGeometryDraftTools({
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
}) {
  const drawDraft = useCallback(
    (geometry, system) => {
      if (!schema?._id || !blankFormTemplate) {
        system?.notify?.("Schema not loaded.");
        return false;
      }

      const completedGeometry = completeDraftGeometry(
        geometry,
        isSingleCollapseAllowed(schema?.geometry?.types, geometry?.type),
      );

      if (!completedGeometry) {
        system?.notify?.("Finish drawing the geometry before continuing.");
        return false;
      }

      setDraftGeometry(completedGeometry);
      setIsDrawing(false);
      setToolbarVisible(false);
      setIsAddPanelOpen(true);

      return true;
    },
    [schema?._id, blankFormTemplate],
  );

  const finishDrawing = useCallback(
    (system) => {
      if (
        !canFinishDraftGeometry(
          draftGeometry,
          isSingleCollapseAllowed(schema?.geometry?.types, draftGeometry?.type),
        )
      ) {
        return false;
      }

      return drawDraft(draftGeometry, system);
    },
    [draftGeometry, drawDraft],
  );

  const addPanelOnClose = useCallback(() => {
    setIsAddPanelOpen(false);
    setDraftGeometry(null);
    setToolbarVisible(true);

    const drawToolSelected =
      geometryTool === "point" ||
      geometryTool === "line" ||
      geometryTool === "polygon" ||
      geometryTool === "multipoint" ||
      geometryTool === "multiline" ||
      geometryTool === "multipolygon";

    setIsDrawing(drawToolSelected);
  }, [geometryTool]);

  /*
   * Generic "finish editing this item's geometry" handler, shared by
   * every geometry edit tool (move, remove point, add midpoint, ...):
   * none of them are special-cased here, since the shared
   * completeDraftGeometry/validateGeometryPayload functions and the
   * update-geometry route don't care which tool produced the final
   * draftGeometry, only whether it's valid.
   */
  const finishGeometryEdit = useCallback(
    async (dataItem, system) => {
      if (!dataItem?._id || !dataItem?.updatedAt) {
        system?.notify?.("Select a geometry to edit.");

        return null;
      }

      if (dataItem?.userRole !== "editor") {
        system?.notify?.(
          "You can only edit the geometry of data items you can edit.",
        );

        return null;
      }

      const completedGeometry = completeDraftGeometry(
        draftGeometry,
        isSingleCollapseAllowed(schema?.geometry?.types, draftGeometry?.type),
      );

      if (!completedGeometry) {
        system?.notify?.("The geometry is not valid.");

        return null;
      }

      if (!validateGeometryPayload(schema, completedGeometry)) {
        system?.notify?.("The geometry is not valid.");

        return null;
      }

      const { data: apiResponse, message } = await apis.engineApi.updateGeometry(
        schema._id,
        schema.updatedAt,
        dataItem._id,
        completedGeometry,
        dataItem.updatedAt,
      );

      system?.notify?.(message);

      const result = apiResponse?.data;

      if (!result?._id || !result?.updatedAt) {
        return null;
      }

      const updatedDataItem = structuredClone(dataItem);

      updatedDataItem.geometry = structuredClone(
        result.geometry || completedGeometry,
      );

      updatedDataItem.time = structuredClone(result.time || dataItem.time);

      updatedDataItem.updatedAt = result.updatedAt;

      dataUtils.updateDataItemInList(setData, updatedDataItem);

      setDraftGeometry(structuredClone(updatedDataItem.geometry));

      return updatedDataItem;
    },
    [schema, draftGeometry, apis, dataUtils, setData],
  );

  return {
    drawDraft,
    finishDrawing,
    addPanelOnClose,
    finishGeometryEdit,
  };
}
