// server/utils/getExportableProjectDocs.js

/*
 * Reads the documents an export needs, for the one export that still
 * happens on the server.
 *
 * The GeoJSON builders moved to shared/exports/geoJSONExport.js when
 * exporting became a front-end concern - the browser assembles every
 * export from data it already holds, and it only holds that data
 * because the read routes checked access before sending it.
 *
 * One route still needs the server: exporting a project the user has
 * NOT opened, from the projects list. There is no loaded data to build
 * from there, so that route reads the documents with the query below
 * and hands them to the same shared builders the client uses.
 */

import { ObjectId } from "mongodb";

/*
 * presence is deliberately absent. A presence item is a person GPS
 * position, so it never leaves in an export - the lookup below returns
 * null for it and the query is skipped entirely. The same rule is
 * enforced again in shared/exports/geoJSONExport.js buildProjectDataFeatures,
 * which the front-end exports go through.
 */
const ENGINE_TO_DOC_TYPE = {
  places: "place",
  events: "event",
  neighbourhoods: "neighbourhood",
  motion: "motion",
};

function toIdString(value) {
  if (!value) return "";
  return String(value);
}

function getSafeCollectionName(engineKey) {
  return typeof engineKey === "string" ? engineKey.trim() : "";
}

function getExpectedDocType(engineKey) {
  return ENGINE_TO_DOC_TYPE[engineKey] || null;
}

export async function getExportableProjectDocs(db, project, selectedIds = null) {
  const collectionName = getSafeCollectionName(project.engineKey);
  const expectedDocType = getExpectedDocType(project.engineKey);

  if (!collectionName || !expectedDocType) {
    return [];
  }

  const projectId = project._id;

  const query = {
    $and: [
      {
        $or: [{ projectId }, { projectId: toIdString(projectId) }],
      },
      { type: expectedDocType },
    ],
  };

  if (Array.isArray(selectedIds)) {
    if (selectedIds.length === 0) {
      return [];
    }

    const normalizedIds = selectedIds
      .map((id) => {
        try {
          return new ObjectId(String(id));
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    if (normalizedIds.length === 0) {
      return [];
    }

    query.$and.push({
      _id: { $in: normalizedIds },
    });
  }

  const docs = await db.collection(collectionName).find(query).toArray();
  return docs;
}
