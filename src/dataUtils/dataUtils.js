

export function updateDataItemInList(setter, updatedDataItem) {
  setter((prev) => {
    const index = prev.findIndex(
      (dataItem) => dataItem._id === updatedDataItem._id,
    );

    if (index === -1) {
      console.warn(
        "updateDataItemInList: data item not found",
        updatedDataItem._id,
      );
      return prev;
    }

    const next = [...prev];
    next[index] = updatedDataItem;
    return next;
  });
}

export function insertDataItemInList(setData, dataItem) {
  if (typeof setData !== "function" || !dataItem?._id) return;

  setData((prev) => (Array.isArray(prev) ? [dataItem, ...prev] : prev));
}

export function removeDataItemFromList(setData, id) {
  if (typeof setData !== "function" || id == null) return;

  setData((prev) =>
    Array.isArray(prev)
      ? prev.filter((dataItem) => String(dataItem?._id) !== String(id))
      : prev,
  );
}

export function removeDataItemsFromList(setData, shouldRemove) {
  if (typeof setData !== "function" || typeof shouldRemove !== "function") {
    return;
  }

  setData((prev) =>
    Array.isArray(prev)
      ? prev.filter((dataItem) => !shouldRemove(dataItem))
      : prev,
  );
}

export function selectDataItemById(setSelectedDataItem, data, id) {
  if (!id || !Array.isArray(data)) {
    setSelectedDataItem(null);
    return;
  }

  const found = data.find((dataItem) => dataItem._id === id);
  setSelectedDataItem(found ?? null);
}

export function getPreviewText(previewText, dataItem, schema) {
  const isPresenceEngine = schema?.engineKey === "presence";

  if (!previewText || previewText.trim() === "") {
    return isPresenceEngine ? [] : ["Selected Item"];
  }

  try {
    const parts = previewText.trim().split(/\s+/).filter(Boolean);
    const displayLines = [];

    parts.forEach((part) => {
      const sectionMatch = part.match(/sections\[(\d+)\]/);
      const inputMatch = part.match(/inputs\[(\d+)\]/);

      if (!sectionMatch || !inputMatch) return;

      const sectionIndex = parseInt(sectionMatch[1], 10);
      const inputIndex = parseInt(inputMatch[1], 10);

      const schemaSection = schema?.sections?.[sectionIndex];
      const schemaInput = schemaSection?.inputs?.[inputIndex];

      if (!schemaSection || !schemaInput) return;

      const dataSection =
        dataItem?.sectionById?.get(schemaSection.id) ||
        dataItem?.sectionById?.get(String(schemaSection.id));

      const dataInput =
        dataSection?.inputById?.get(schemaInput.id) ||
        dataSection?.inputById?.get(String(schemaInput.id));

      if (!dataInput) return;

      const label = schemaInput.label;
      const value = dataInput.value;

      if (part.endsWith(".label")) {
        const valuePart = `sections[${sectionIndex}].inputs[${inputIndex}].value`;
        const hasValue = parts.includes(valuePart);

        displayLines.push(hasValue ? `${label}: ${value ?? ""}` : `${label}`);
      } else if (part.endsWith(".value")) {
        const labelPart = `sections[${sectionIndex}].inputs[${inputIndex}].label`;
        const wasHandled = parts.includes(labelPart);

        if (!wasHandled && value != null && value !== "") {
          displayLines.push(`${value}`);
        }
      }
    });

    return displayLines.length > 0
      ? displayLines
      : isPresenceEngine
        ? []
        : ["Selected Item"];
  } catch (err) {
    console.error("Error parsing previewText string:", err);
    return isPresenceEngine ? [] : ["Selected Item"];
  }
}

export function buildAddPayloadFromForm(formData) {
  if (!formData) return null;

  const layer = Number(formData.layer || 1);

  if (layer === 2) {
    return {
      layer,
      parentDataItemId: formData.parentDataItemId,
      geometry: structuredClone(formData.geometry),
      time: structuredClone(formData.time),
      sections: structuredClone(formData.sections || []),
      extensions: structuredClone(formData.extensions || {}),
    };
  }

  return {
    layer,
    geometry: structuredClone(formData.geometry),
    time: structuredClone(formData.time),
    sections: structuredClone(formData.sections || []),
    extensions: structuredClone(formData.extensions || {}),
  };
}

/*
 * The regular update route never changes a Polygon's or LineString's
 * coordinates (that only ever happens through add, or - for
 * points/lines the move/drag route) - the edit panel only lets those
 * two types' colors change. So the update payload only ever needs to
 * carry those colors, not the coordinates/bbox/centroid/distance/
 * midpoint the form still holds in memory for display. Point is left
 * as-is: its lat/lng are directly editable in the edit panel, so its
 * full geometry (coordinates included) still needs to go out.
 */
function buildUpdateGeometryPayload(geometry) {
  if (!geometry || typeof geometry !== "object") {
    return structuredClone(geometry);
  }

  if (geometry.type === "LineString") {
    return {
      type: "LineString",
      lineColor: geometry.lineColor,
    };
  }

  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      borderColor: geometry.borderColor,
      fillColor: geometry.fillColor,
    };
  }

  if (geometry.type === "MultiPoint") {
    return {
      type: "MultiPoint",
      borderColor: geometry.borderColor,
      fillColor: geometry.fillColor,
    };
  }

  if (geometry.type === "MultiLineString") {
    return {
      type: "MultiLineString",
      lineColor: geometry.lineColor,
    };
  }

  if (geometry.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      borderColor: geometry.borderColor,
      fillColor: geometry.fillColor,
    };
  }

  return structuredClone(geometry);
}

export function buildUpdatePayloadFromForm(formData) {
  if (!formData) {
    return null;
  }

  return {
    _id: formData._id,
    geometry: buildUpdateGeometryPayload(formData.geometry),
    time: structuredClone(formData.time),
    sections: structuredClone(formData.sections || []),
    updatedAt: formData.updatedAt,
  };
}

