// server/routes/places.js
import express from "express";
import { smallJson, mediumJson, extraLargeImportJson } from "../middleware/bodyLimits.js";
import { ObjectId } from "mongodb";
import { getDB } from "../db.js";
import { storage } from "../media/mediaService.js";
import { hasProjectAccess } from "../utils/projectPermissions.js";
import { getDataItemUserRole } from "../utils/dataItemPermissions.js";
import { PROJECT_LIMITS } from "../../shared/validation/validationConstants.js";
import {
  normalizeTagListSections,
  mergeTagsIntoProjectSections,
  recomputeProjectTagSections,
  removeUnusedCustomTagsAfterDataItemUpdate,
} from "../utils/tagListHelpers.js";

import {
  normalizePriceRangeSections,
  recomputeProjectPriceSections,
} from "../utils/priceRangeHelpers.js";
import {
  hasExactKeys,
  validateDataItemPayload,
  validateExtensionsPayload,
  validateGeometryPayload,
} from "../../shared/validation/dataValidation.js";
import { buildDataItemFieldsFromForm } from "../utils/dataUtils.js";
import { geometryCrossesAntimeridian } from "../../shared/validation/geometryBoundaryValidation.js";

import { reapplyTimezoneFromLatLng } from "../../shared/time/reapplyTimezoneFromLatLng.js";

const router = express.Router();

/* ─────────────────────────────
   POST - Get All places
───────────────────────────── */
router.post("/get", smallJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["projectId"])) {
    return res.status(400).json({
      error: "Invalid get places payload.",
    });
  }

  const { projectId } = req.body;

  if (!projectId) {
    return res.status(400).json({ error: "Missing projectId." });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);

    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized." });
    }

    const access = hasProjectAccess(project, userId, "viewer");

    if (!access.hasAccess) {
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized." });
    }

    const places = await db
      .collection("places")
      .find({
        projectId: projectObjectId,
        type: "place",
      })
      .toArray();

    if (places.length === 0) {
      return res.json({
        message: "No places found",
        data: [],
      });
    }

    const safePlaces = places.map((place) => {
      const safePlace = {
        ...place,
        userRole: getDataItemUserRole(place, userId, access),
      };

      delete safePlace.projectOwnerId;
      delete safePlace.createdByUserId;

      return safePlace;
    });

    return res.json({
      message: "Places retrieved",
      data: safePlaces,
    });
  } catch (err) {
    console.error("Fetch failed:", err);
    return res.status(500).json({ error: "Failed to fetch places" });
  }
});

/* ─────────────────────────────
   POST - Get One place
───────────────────────────── */
router.post("/get/:_id", smallJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["projectId"])) {
    return res.status(400).json({
      error: "Invalid get place payload.",
    });
  }
  const { projectId } = req.body;
  const { _id } = req.params;

  if (!projectId || !_id) {
    return res.status(400).json({ error: "Missing projectId or _id." });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);
    const placeObjectId = new ObjectId(_id);

    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized." });
    }

    const access = hasProjectAccess(project, userId, "viewer");

    if (!access.hasAccess) {
      return res
        .status(404)
        .json({ error: "Place not found or unauthorized." });
    }

    const place = await db.collection("places").findOne({
      projectId: projectObjectId,
      _id: placeObjectId,
      type: "place",
    });

    if (!place) {
      return res
        .status(404)
        .json({ error: "Place not found or unauthorized." });
    }

    const safePlace = {
      ...place,
      userRole: getDataItemUserRole(place, userId, access),
    };

    delete safePlace.projectOwnerId;
    delete safePlace.createdByUserId;

    return res.json({
      message: "Place retrieved",
      data: safePlace,
    });
  } catch (err) {
    console.error("Fetch one failed:", err);
    return res.status(500).json({ error: "Failed to fetch place" });
  }
});

/* ─────────────────────────────
   POST - Add place
───────────────────────────── */
router.post("/add", mediumJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["projectId", "schemaUpdatedAt", "place"])) {
    return res.status(400).json({
      error: "Invalid add place payload.",
    });
  }
  const { projectId, schemaUpdatedAt, place } = req.body;

  if (!projectId || !schemaUpdatedAt || !place) {
    return res
      .status(400)
      .json({ error: "Missing projectId, schemaUpdatedAt, or place." });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);

    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized." });
    }

    const access = hasProjectAccess(project, userId, "editor");

    if (!access.hasAccess) {
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized." });
    }

    const incomingSchemaUpdatedAt = new Date(schemaUpdatedAt);
    const databaseSchemaUpdatedAt = new Date(project.updatedAt);

    if (
      !Number.isFinite(incomingSchemaUpdatedAt.getTime()) ||
      !Number.isFinite(databaseSchemaUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid schema timestamp. Reload before adding.",
      });
    }

    if (
      incomingSchemaUpdatedAt.getTime() !== databaseSchemaUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This project's schema has changed since you loaded it. Reload before adding.",
      });
    }

    const existingPlaces = await db
      .collection("places")
      .find({
        projectId: projectObjectId,
        type: "place",
      })
      .toArray();

    if (existingPlaces.length >= PROJECT_LIMITS.maxDataItems) {
      return res.status(400).json({
        error: `This project has reached the maximum of ${PROJECT_LIMITS.maxDataItems} places.`,
      });
    }

    const validation = validateDataItemPayload({
      schema: project,
      dataItem: place,
      mode: "add",
    });

    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.error || "Invalid place payload.",
      });
    }

    const layer = Number(place.layer);
    let parentDataItemId = null;

    if (layer === 2) {
      if (!ObjectId.isValid(place.parentDataItemId)) {
        return res.status(400).json({
          error: "Invalid parent data item.",
        });
      }

      parentDataItemId = new ObjectId(place.parentDataItemId);

      const parentPlace = await db.collection("places").findOne({
        projectId: projectObjectId,
        _id: parentDataItemId,
        type: "place",
        layer: 1,
      });

      if (!parentPlace) {
        return res.status(400).json({
          error: "Invalid parent data item.",
        });
      }
    }

    const safePlace = buildDataItemFieldsFromForm(project, place, {
      includeExtensions: true,
    });

    if (!safePlace) {
      return res.status(400).json({ error: "Invalid place payload." });
    }

    safePlace.sections = normalizeTagListSections(
      project.sections,
      safePlace.sections,
    );

    safePlace.sections = normalizePriceRangeSections(
      project.sections,
      safePlace.sections,
    );

    const now = new Date();

    const insertDoc =
      layer === 2
        ? {
            projectId: projectObjectId,
            projectOwnerId: project.projectOwnerId,
            createdByUserId: userId,
            type: "place",
            layer,
            parentDataItemId,
            geometry: safePlace.geometry,
            time: safePlace.time,
            sections: safePlace.sections,
            extensions: safePlace.extensions,
            createdAt: now,
            updatedAt: now,
          }
        : {
            projectId: projectObjectId,
            projectOwnerId: project.projectOwnerId,
            createdByUserId: userId,
            type: "place",
            layer,
            geometry: safePlace.geometry,
            time: safePlace.time,
            sections: safePlace.sections,
            extensions: safePlace.extensions,
            createdAt: now,
            updatedAt: now,
          };

    const prospectivePlaces = [...existingPlaces, insertDoc];

    const { nextSections: tagMergedSections, addedCustomTags } =
      mergeTagsIntoProjectSections(project.sections, insertDoc.sections);

    const {
      nextSections,
      addedCustomCategories,
      removedCustomCategories,
      addedCustomUnits,
      removedCustomUnits,
    } = recomputeProjectPriceSections(tagMergedSections, prospectivePlaces);

    const result = await db.collection("places").insertOne(insertDoc);

    const shouldUpdateProject =
      addedCustomTags.length > 0 ||
      addedCustomCategories.length > 0 ||
      removedCustomCategories.length > 0 ||
      addedCustomUnits.length > 0 ||
      removedCustomUnits.length > 0;

    let schemaUpdatedAtResult = project.updatedAt;

    if (shouldUpdateProject) {
      schemaUpdatedAtResult = new Date();

      await db.collection("projects").updateOne(
        { _id: projectObjectId },
        {
          $set: {
            sections: nextSections,
            updatedAt: schemaUpdatedAtResult,
          },
        },
      );
    }

    const safeInsertedPlace = {
      _id: result.insertedId,
      ...insertDoc,
    };

    delete safeInsertedPlace.projectOwnerId;
    delete safeInsertedPlace.createdByUserId;

    return res.status(201).json({
      message: "Place added",
      data: safeInsertedPlace,
      schemaUpdatedAt: schemaUpdatedAtResult,
      addedCustomTags,
      addedCustomCategories,
      removedCustomCategories,
      addedCustomUnits,
      removedCustomUnits,
    });
  } catch (err) {
    console.error("Insert failed:", err);

    if (err?.status === 400) {
      return res.status(400).json({
        error: err.message || "Invalid tag list or price range data.",
      });
    }

    return res.status(500).json({ error: "Failed to add place" });
  }
});

/* ─────────────────────────────
   POST - Add place batch (import geometry)
   Unlike neighbourhoods.js's own /add-batch (which aborts the whole
   request on the first invalid item), this tolerates individually bad
   items per Brody's own call for the "Import Geometry" tool: the
   client (src/forms/ImportGeometryModal.jsx, via
   src/forms/importGeometryHelpers.js) already filters and validates
   every item itself before ever sending this request, so a rejection
   here should be rare - but when the client is wrong or out of date,
   this skips just the bad item and imports everything else, only
   failing the whole request if NOT ONE item survives. geometryCrossesAntimeridian
   is this route's own extra defense on top of the regular
   validateDataItemPayload check - see that function's own comment for
   why only import needs it (the regular /add route can't receive a
   geometry like this in the first place, since nothing can draw one).
───────────────────────────── */
router.post("/add-batch", extraLargeImportJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["projectId", "places"])) {
    return res.status(400).json({
      error: "Invalid add place batch payload.",
    });
  }

  const { projectId, places } = req.body;

  if (!projectId || !Array.isArray(places) || places.length === 0) {
    return res.status(400).json({
      error: "Missing projectId or places.",
    });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);
    const now = new Date();

    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const access = hasProjectAccess(project, userId, "editor");

    if (!access.hasAccess) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const existingPlaceCount = await db.collection("places").countDocuments({
      projectId: projectObjectId,
      type: "place",
    });

    if (existingPlaceCount + places.length > PROJECT_LIMITS.maxDataItems) {
      return res.status(400).json({
        error:
          `This project has reached the maximum of ${PROJECT_LIMITS.maxDataItems} places. ` +
          `You currently have ${existingPlaceCount}, and this import would add ${places.length}.`,
      });
    }

    const survivingIndexes = [];
    const insertDocs = [];

    for (let i = 0; i < places.length; i += 1) {
      const place = places[i];

      const validation = validateDataItemPayload({
        schema: project,
        dataItem: place,
        mode: "add",
      });

      if (!validation.isValid) continue;
      if (geometryCrossesAntimeridian(place.geometry)) continue;

      const layer = Number(place.layer);
      let parentDataItemId = null;

      if (layer === 2) {
        if (!ObjectId.isValid(place.parentDataItemId)) continue;

        parentDataItemId = new ObjectId(place.parentDataItemId);

        const parentPlace = await db.collection("places").findOne({
          projectId: projectObjectId,
          _id: parentDataItemId,
          type: "place",
          layer: 1,
        });

        if (!parentPlace) continue;
      }

      const safePlace = buildDataItemFieldsFromForm(project, place, {
        includeExtensions: true,
      });

      if (!safePlace) continue;

      safePlace.sections = normalizeTagListSections(
        project.sections,
        safePlace.sections,
      );

      safePlace.sections = normalizePriceRangeSections(
        project.sections,
        safePlace.sections,
      );

      const insertDoc =
        layer === 2
          ? {
              projectId: projectObjectId,
              projectOwnerId: project.projectOwnerId,
              createdByUserId: userId,
              type: "place",
              layer,
              parentDataItemId,
              geometry: safePlace.geometry,
              time: safePlace.time,
              sections: safePlace.sections,
              extensions: safePlace.extensions,
              createdAt: now,
              updatedAt: now,
            }
          : {
              projectId: projectObjectId,
              projectOwnerId: project.projectOwnerId,
              createdByUserId: userId,
              type: "place",
              layer,
              geometry: safePlace.geometry,
              time: safePlace.time,
              sections: safePlace.sections,
              extensions: safePlace.extensions,
              createdAt: now,
              updatedAt: now,
            };

      survivingIndexes.push(i);
      insertDocs.push(insertDoc);
    }

    if (insertDocs.length === 0) {
      return res.status(400).json({
        error: "No valid places to import.",
      });
    }

    /*
     * Deliberately no mergeTagsIntoProjectSections/
     * recomputeProjectPriceSections/project update here, unlike the
     * single /add route above - per Brody's own call, a geometry-only
     * import never carries any of its own property values into a
     * data item's sections (see importGeometryHelpers.js's own
     * header comment: every imported item is just the schema's own
     * blank/default template plus geometry), so it can never
     * introduce a new custom tag/category/unit the project's schema
     * doesn't already know about. normalizeTagListSections/
     * normalizePriceRangeSections above still run per item - those
     * only reshape/validate each item's own sections against the
     * CURRENT schema, not mutate the project - matching
     * neighbourhoods.js's own /add-batch, which skips this same step
     * for the same reason.
     */
    const result = await db.collection("places").insertMany(insertDocs);
    const insertedIdsByOffset = Object.values(result.insertedIds);

    const inserted = survivingIndexes.map((originalIndex, offset) => ({
      index: originalIndex,
      _id: insertedIdsByOffset[offset],
      createdAt: now,
      updatedAt: now,
    }));

    const rejectedCount = places.length - inserted.length;

    return res.status(201).json({
      message:
        rejectedCount > 0
          ? `${inserted.length} of ${places.length} places imported (${rejectedCount} rejected).`
          : `${inserted.length} places imported.`,
      data: {
        inserted,
        insertedCount: inserted.length,
        rejectedCount,
      },
    });
  } catch (err) {
    console.error("Batch insert failed:", err);

    if (err?.status === 400) {
      return res.status(400).json({
        error: err.message || "Invalid tag list or price range data.",
      });
    }

    return res.status(500).json({ error: "Failed to add place batch" });
  }
});

/* ─────────────────────────────
   PUT - Update place
───────────────────────────── */
router.put("/update/:_id", mediumJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["projectId", "schemaUpdatedAt", "place"])) {
    return res.status(400).json({
      error: "Invalid update place payload.",
    });
  }
  const { projectId, schemaUpdatedAt, place } = req.body;
  const { _id } = req.params;

  if (!projectId || !schemaUpdatedAt || !place || !_id) {
    return res
      .status(400)
      .json({ error: "Missing projectId, schemaUpdatedAt, place, or _id." });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);
    const placeObjectId = new ObjectId(_id);

    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized." });
    }

    const access = hasProjectAccess(project, userId, "editor");

    if (!access.hasAccess) {
      return res
        .status(404)
        .json({ error: "Place not found or unauthorized." });
    }

    const incomingSchemaUpdatedAt = new Date(schemaUpdatedAt);
    const databaseSchemaUpdatedAt = new Date(project.updatedAt);

    if (
      !Number.isFinite(incomingSchemaUpdatedAt.getTime()) ||
      !Number.isFinite(databaseSchemaUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid schema timestamp. Reload before updating.",
      });
    }

    if (
      incomingSchemaUpdatedAt.getTime() !== databaseSchemaUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This project's schema has changed since you loaded it. Reload before updating.",
      });
    }

    const existingPlace = await db.collection("places").findOne({
      projectId: projectObjectId,
      _id: placeObjectId,
      type: "place",
    });

    if (!existingPlace) {
      return res
        .status(404)
        .json({ error: "Place not found or unauthorized." });
    }

    const canEditAny = access.isAdmin;
    const isCreatedByUser =
      String(existingPlace.createdByUserId || "") === String(userId);

    if (!canEditAny && !isCreatedByUser) {
      return res.status(403).json({
        error: "Editors can only update places they created.",
      });
    }

    const validation = validateDataItemPayload({
      schema: project,
      dataItem: place,
      mode: "update",
    });

    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.error || "Invalid place payload.",
      });
    }

    if (String(place._id) !== String(_id)) {
      return res.status(400).json({
        error: "Invalid place payload.",
      });
    }

    const incomingPlaceUpdatedAt = new Date(place.updatedAt);
    const databasePlaceUpdatedAt = new Date(existingPlace.updatedAt);

    if (
      !Number.isFinite(incomingPlaceUpdatedAt.getTime()) ||
      !Number.isFinite(databasePlaceUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid place timestamp. Reload before updating.",
      });
    }

    if (incomingPlaceUpdatedAt.getTime() !== databasePlaceUpdatedAt.getTime()) {
      return res.status(409).json({
        error:
          "This place has changed since you loaded it. Reload before updating.",
      });
    }

    const safePlace = buildDataItemFieldsFromForm(project, place, {
      includeExtensions: false,
      existingGeometry: existingPlace.geometry,
    });

    if (!safePlace) {
      return res.status(400).json({ error: "Invalid place payload." });
    }

    safePlace.sections = normalizeTagListSections(
      project.sections,
      safePlace.sections,
    );

    safePlace.sections = normalizePriceRangeSections(
      project.sections,
      safePlace.sections,
    );

    const now = new Date();

    const prospectiveUpdatedPlace = {
      ...existingPlace,
      ...safePlace,
      updatedAt: now,
    };

    const otherPlaces = await db
      .collection("places")
      .find({
        projectId: projectObjectId,
        type: "place",
        _id: { $ne: placeObjectId },
      })
      .toArray();

    const prospectivePlaces = [...otherPlaces, prospectiveUpdatedPlace];

    const { nextSections: tagMergedSections, addedCustomTags } =
      mergeTagsIntoProjectSections(
        project.sections,
        prospectiveUpdatedPlace.sections,
      );

    const { nextSections: tagCleanedSections, removedCustomTags } =
      removeUnusedCustomTagsAfterDataItemUpdate(
        tagMergedSections,
        existingPlace.sections,
        prospectiveUpdatedPlace.sections,
        otherPlaces,
      );

    const {
      nextSections,
      addedCustomCategories,
      removedCustomCategories,
      addedCustomUnits,
      removedCustomUnits,
    } = recomputeProjectPriceSections(tagCleanedSections, prospectivePlaces);

    const updateResult = await db.collection("places").findOneAndUpdate(
      {
        projectId: projectObjectId,
        _id: placeObjectId,
        type: "place",
      },
      {
        $set: {
          ...safePlace,
          updatedAt: now,
        },
      },
      {
        returnDocument: "after",
      },
    );

    const updatedPlace = updateResult?.value;

    if (!updatedPlace) {
      return res
        .status(404)
        .json({ error: "Place not found or unauthorized." });
    }

    const shouldUpdateProject =
      addedCustomTags.length > 0 ||
      removedCustomTags.length > 0 ||
      addedCustomCategories.length > 0 ||
      removedCustomCategories.length > 0 ||
      addedCustomUnits.length > 0 ||
      removedCustomUnits.length > 0;

    let schemaUpdatedAtResult = project.updatedAt;

    if (shouldUpdateProject) {
      schemaUpdatedAtResult = new Date();

      await db.collection("projects").updateOne(
        { _id: projectObjectId },
        {
          $set: {
            sections: nextSections,
            updatedAt: schemaUpdatedAtResult,
          },
        },
      );
    }

    const safeUpdatedPlace = { ...updatedPlace };

    delete safeUpdatedPlace.projectOwnerId;
    delete safeUpdatedPlace.createdByUserId;

    return res.json({
      message: "Place updated",
      data: safeUpdatedPlace,
      schemaUpdatedAt: schemaUpdatedAtResult,
      addedCustomTags,
      removedCustomTags,
      addedCustomCategories,
      removedCustomCategories,
      addedCustomUnits,
      removedCustomUnits,
    });
  } catch (err) {
    console.error("Update failed:", err);

    if (err?.status === 400) {
      return res.status(400).json({
        error: err.message || "Invalid tag list or price range data.",
      });
    }

    return res.status(500).json({ error: "Failed to update place" });
  }
});

/* ─────────────────────────────
   DELETE - Remove place (Cascade Cleanup)
───────────────────────────── */
router.delete("/remove/:_id", smallJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["projectId", "schemaUpdatedAt", "updatedAt"])) {
    return res.status(400).json({
      error: "Invalid remove place payload.",
    });
  }
  const { projectId, schemaUpdatedAt, updatedAt } = req.body;
  const { _id } = req.params;

  if (!projectId || !schemaUpdatedAt || !updatedAt || !_id) {
    return res.status(400).json({
      error: "Missing projectId, schemaUpdatedAt, updatedAt, or _id.",
    });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);
    const placeObjectId = new ObjectId(_id);

    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const access = hasProjectAccess(project, userId, "editor");

    if (!access.hasAccess) {
      return res.status(404).json({
        error: "Place not found or unauthorized.",
      });
    }

    const incomingSchemaUpdatedAt = new Date(schemaUpdatedAt);
    const databaseSchemaUpdatedAt = new Date(project.updatedAt);

    if (
      !Number.isFinite(incomingSchemaUpdatedAt.getTime()) ||
      !Number.isFinite(databaseSchemaUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid schema timestamp. Reload before deleting.",
      });
    }

    if (
      incomingSchemaUpdatedAt.getTime() !== databaseSchemaUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This project's schema has changed since you loaded it. Reload before deleting.",
      });
    }

    const existingPlace = await db.collection("places").findOne({
      projectId: projectObjectId,
      _id: placeObjectId,
      type: "place",
    });

    if (!existingPlace) {
      return res.status(404).json({
        error: "Place not found or unauthorized.",
      });
    }

    const canEditAny = access.isAdmin;
    const isCreatedByUser =
      String(existingPlace.createdByUserId || "") === String(userId);

    if (!canEditAny && !isCreatedByUser) {
      return res.status(403).json({
        error: "Editors can only delete places they created.",
      });
    }

    const incomingPlaceUpdatedAt = new Date(updatedAt);
    const databasePlaceUpdatedAt = new Date(existingPlace.updatedAt);

    if (
      !Number.isFinite(incomingPlaceUpdatedAt.getTime()) ||
      !Number.isFinite(databasePlaceUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid place timestamp. Reload before deleting.",
      });
    }

    if (incomingPlaceUpdatedAt.getTime() !== databasePlaceUpdatedAt.getTime()) {
      return res.status(409).json({
        error:
          "This place has changed since you loaded it. Reload before deleting.",
      });
    }

    const summary = [];

    async function removePlaceExtensionData(dataItemId) {
      const extensionSummary = [];

      /* ─────────────────────────────
         Remove Gallery Images
      ───────────────────────────── */
      const images = await db
        .collection("places")
        .find({
          projectId: projectObjectId,
          dataItemId,
          type: "image",
        })
        .toArray();

      if (images.length > 0) {
        for (const img of images) {
          if (img.original?.r2Key) {
            await storage.removeObject(img.original.r2Key);
          }

          if (img.thumb?.r2Key) {
            await storage.removeObject(img.thumb.r2Key);
          }
        }

        const imageDeleteResult = await db.collection("places").deleteMany({
          projectId: projectObjectId,
          dataItemId,
          type: "image",
        });

        if (imageDeleteResult.deletedCount > 0) {
          extensionSummary.push(
            `${imageDeleteResult.deletedCount} gallery images removed`,
          );
        }
      }

      /* ─────────────────────────────
         Remove Guestbook
      ───────────────────────────── */
      const guestbookResult = await db.collection("places").deleteOne({
        projectId: projectObjectId,
        dataItemId,
        type: "guestbook",
      });

      if (guestbookResult.deletedCount === 1) {
        extensionSummary.push("Guestbook removed");
      }

      return extensionSummary;
    }

    /* ─────────────────────────────
       Remove Layer 2 Child Places First
    ───────────────────────────── */
    if (Number(existingPlace.layer) === 1) {
      const childPlaces = await db
        .collection("places")
        .find({
          projectId: projectObjectId,
          type: "place",
          layer: 2,
          parentDataItemId: placeObjectId,
        })
        .toArray();

      if (childPlaces.length > 0) {
        for (const childPlace of childPlaces) {
          await removePlaceExtensionData(childPlace._id);
        }

        const childDeleteResult = await db.collection("places").deleteMany({
          projectId: projectObjectId,
          type: "place",
          layer: 2,
          parentDataItemId: placeObjectId,
        });

        if (childDeleteResult.deletedCount > 0) {
          summary.push(
            `${childDeleteResult.deletedCount} layer 2 places removed`,
          );
        }
      }
    }

    /* ─────────────────────────────
       Remove Target Place Extension Data
    ───────────────────────────── */
    const targetExtensionSummary =
      await removePlaceExtensionData(placeObjectId);
    summary.push(...targetExtensionSummary);

    /* ─────────────────────────────
       Remove Target Place
    ───────────────────────────── */
    const placeDeleteResult = await db.collection("places").deleteOne({
      projectId: projectObjectId,
      _id: placeObjectId,
      type: "place",
    });

    if (placeDeleteResult.deletedCount !== 1) {
      return res.status(404).json({
        error: "Place not found or unauthorized.",
      });
    }

    summary.push("Place removed");

    const remainingPlaces = await db
      .collection("places")
      .find({
        projectId: projectObjectId,
        type: "place",
      })
      .toArray();

    const { nextSections: tagRecomputedSections, removedCustomTags } =
      recomputeProjectTagSections(project.sections, remainingPlaces);

    const {
      nextSections,
      addedCustomCategories,
      removedCustomCategories,
      addedCustomUnits,
      removedCustomUnits,
    } = recomputeProjectPriceSections(tagRecomputedSections, remainingPlaces);

    const shouldUpdateProject =
      removedCustomTags.length > 0 ||
      addedCustomCategories.length > 0 ||
      removedCustomCategories.length > 0 ||
      addedCustomUnits.length > 0 ||
      removedCustomUnits.length > 0;

    let schemaUpdatedAtResult = project.updatedAt;

    if (shouldUpdateProject) {
      schemaUpdatedAtResult = new Date();

      await db.collection("projects").updateOne(
        { _id: projectObjectId },
        {
          $set: {
            sections: nextSections,
            updatedAt: schemaUpdatedAtResult,
          },
        },
      );
    }

    return res.json({
      message: summary.join("\n"),
      data: { _id },
      schemaUpdatedAt: schemaUpdatedAtResult,
      removedCustomTags,
      addedCustomCategories,
      removedCustomCategories,
      addedCustomUnits,
      removedCustomUnits,
    });
  } catch (err) {
    console.error("Delete failed:", err);

    if (err?.status === 400) {
      return res.status(400).json({
        error: err.message || "Invalid tag list or price range data.",
      });
    }

    return res.status(500).json({
      error: "Failed to remove place",
    });
  }
});


/*
 * PUT - Update Place Geometry
 *
 * Generic geometry-overwrite route: any front-end tool that produces
 * a new, fully valid geometry for this item (drag-to-move, remove a
 * vertex, insert a midpoint, ...) sends the finished result here. The
 * route itself doesn't know or care which tool produced it - it just
 * validates the geometry the same way add does (full validation, not
 * the colors-only update-mode validator) and overwrites the stored
 * geometry if it passes, matching the shared front-end/back-end
 * geometry calculation functions in shared/validation/*.js.
 */
router.put("/update-geometry/:_id", smallJson, async (req, res) => {
  if (
    !hasExactKeys(req.body, [
      "projectId",
      "schemaUpdatedAt",
      "geometry",
      "updatedAt",
    ])
  ) {
    return res.status(400).json({
      error: "Invalid geometry update payload.",
    });
  }

  const {
    projectId,
    schemaUpdatedAt,
    geometry,
    updatedAt,
  } = req.body;

  const { _id } = req.params;

  if (
    !projectId ||
    !schemaUpdatedAt ||
    !geometry ||
    !updatedAt ||
    !_id
  ) {
    return res.status(400).json({
      error:
        "Missing projectId, schemaUpdatedAt, geometry, updatedAt, or _id.",
    });
  }

  try {
    const db = getDB();

    const userId =
      new ObjectId(req.userId);

    const projectObjectId =
      new ObjectId(projectId);

    const placeObjectId =
      new ObjectId(_id);

    const project =
      await db.collection("projects").findOne({
        _id: projectObjectId,
      });

    if (!project) {
      return res
        .status(404)
        .json({
          error:
            "Project not found or unauthorized.",
        });
    }

    const access =
      hasProjectAccess(
        project,
        userId,
        "editor",
      );

    if (!access.hasAccess) {
      return res
        .status(404)
        .json({
          error:
            "Place not found or unauthorized.",
        });
    }

    const incomingSchemaUpdatedAt =
      new Date(schemaUpdatedAt);

    const databaseSchemaUpdatedAt =
      new Date(project.updatedAt);

    if (
      !Number.isFinite(
        incomingSchemaUpdatedAt.getTime(),
      ) ||
      !Number.isFinite(
        databaseSchemaUpdatedAt.getTime(),
      )
    ) {
      return res.status(400).json({
        error:
          "Invalid schema timestamp. Reload before continuing.",
      });
    }

    if (
      incomingSchemaUpdatedAt.getTime() !==
      databaseSchemaUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This project's schema has changed since you loaded it. Reload before continuing.",
      });
    }

    const existingPlace =
      await db.collection("places").findOne({
        projectId: projectObjectId,
        _id: placeObjectId,
        type: "place",
      });

    if (!existingPlace) {
      return res
        .status(404)
        .json({
          error:
            "Place not found or unauthorized.",
        });
    }

    const canEditAny =
      access.isAdmin;

    const isCreatedByUser =
      String(
        existingPlace.createdByUserId || "",
      ) === String(userId);

    if (
      !canEditAny &&
      !isCreatedByUser
    ) {
      return res.status(403).json({
        error:
          "Editors can only edit the geometry of places they created.",
      });
    }

    const incomingPlaceUpdatedAt =
      new Date(updatedAt);

    const databasePlaceUpdatedAt =
      new Date(existingPlace.updatedAt);

    if (
      !Number.isFinite(
        incomingPlaceUpdatedAt.getTime(),
      ) ||
      !Number.isFinite(
        databasePlaceUpdatedAt.getTime(),
      )
    ) {
      return res.status(400).json({
        error:
          "Invalid place timestamp. Reload before continuing.",
      });
    }

    if (
      incomingPlaceUpdatedAt.getTime() !==
      databasePlaceUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This place has changed since you loaded it. Reload before continuing.",
      });
    }

    if (
      !validateGeometryPayload(
        project,
        geometry,
        { mode: "geometry" },
      )
    ) {
      return res.status(400).json({
        error: "Invalid geometry.",
      });
    }

   const safeGeometry =
  structuredClone(geometry);

const timezoneTarget = {
  geometry: safeGeometry,

  time: structuredClone(
    existingPlace.time || {},
  ),
};

reapplyTimezoneFromLatLng(
  timezoneTarget,
);

const nextTime =
  timezoneTarget.time;

const now = new Date();

    const updateResult =
      await db
        .collection("places")
        .findOneAndUpdate(
          {
            projectId: projectObjectId,
            _id: placeObjectId,
            type: "place",
          },
          {
            $set: {
              geometry: safeGeometry,
              time: nextTime,
              updatedAt: now,
            },
          },
          {
            returnDocument: "after",
          },
        );

    const updatedPlace =
      updateResult?.value;

    if (!updatedPlace) {
      return res
        .status(404)
        .json({
          error:
            "Place not found or unauthorized.",
        });
    }

    return res.json({
      message: "Place geometry updated",
      data: {
        _id: updatedPlace._id,
        geometry:
          updatedPlace.geometry,
        time:
          updatedPlace.time,
        updatedAt:
          updatedPlace.updatedAt,
      },
    });
  } catch (err) {
    console.error(
      "Geometry update failed:",
      err,
    );

    return res.status(500).json({
      error:
        "Failed to update place geometry",
    });
  }
});

/* ─────────────────────────────
   PUT - Toggle Place Extensions
───────────────────────────── */
router.put("/toggle-extensions/:_id", smallJson, async (req, res) => {
  if (
    !hasExactKeys(req.body, [
      "projectId",
      "schemaUpdatedAt",
      "extensions",
      "updatedAt",
    ])
  ) {
    return res.status(400).json({
      error: "Invalid toggle place extensions payload.",
    });
  }

  const { projectId, schemaUpdatedAt, extensions, updatedAt } = req.body;
  const { _id } = req.params;

  if (!projectId || !schemaUpdatedAt || !extensions || !updatedAt || !_id) {
    return res.status(400).json({
      error:
        "Missing projectId, schemaUpdatedAt, extensions, updatedAt, or _id.",
    });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);
    const placeObjectId = new ObjectId(_id);

    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized." });
    }

    const access = hasProjectAccess(project, userId, "editor");

    if (!access.hasAccess) {
      return res
        .status(404)
        .json({ error: "Place not found or unauthorized." });
    }

    const incomingSchemaUpdatedAt = new Date(schemaUpdatedAt);
    const databaseSchemaUpdatedAt = new Date(project.updatedAt);

    if (
      !Number.isFinite(incomingSchemaUpdatedAt.getTime()) ||
      !Number.isFinite(databaseSchemaUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid schema timestamp. Reload before updating extensions.",
      });
    }

    if (
      incomingSchemaUpdatedAt.getTime() !== databaseSchemaUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This project's schema has changed since you loaded it. Reload before updating extensions.",
      });
    }

    const existingPlace = await db.collection("places").findOne({
      projectId: projectObjectId,
      _id: placeObjectId,
      type: "place",
    });

    if (!existingPlace) {
      return res
        .status(404)
        .json({ error: "Place not found or unauthorized." });
    }

    const canEditAny = access.isAdmin;
    const isCreatedByUser =
      String(existingPlace.createdByUserId || "") === String(userId);

    if (!canEditAny && !isCreatedByUser) {
      return res.status(403).json({
        error: "Editors can only update extensions for places they created.",
      });
    }

    const incomingUpdatedAt = new Date(updatedAt);
    const databaseUpdatedAt = new Date(existingPlace.updatedAt);

    if (
      !Number.isFinite(incomingUpdatedAt.getTime()) ||
      !Number.isFinite(databaseUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid place timestamp. Reload before updating extensions.",
      });
    }

    if (incomingUpdatedAt.getTime() !== databaseUpdatedAt.getTime()) {
      return res.status(409).json({
        error:
          "This place has changed since you loaded it. Reload before updating extensions.",
      });
    }

    if (!validateExtensionsPayload(project, extensions)) {
      return res.status(400).json({
        error: "Invalid extensions.",
      });
    }

    const safeExtensions = structuredClone(extensions);

    const wasGalleryEnabled = existingPlace.extensions?.Gallery === true;
    const nextGalleryEnabled = safeExtensions.Gallery === true;

    const wasGuestbookEnabled = existingPlace.extensions?.Guestbook === true;
    const nextGuestbookEnabled = safeExtensions.Guestbook === true;

    const summary = [];

    if (wasGalleryEnabled && !nextGalleryEnabled) {
      const images = await db
        .collection("places")
        .find({
          projectId: projectObjectId,
          dataItemId: placeObjectId,
          type: "image",
        })
        .toArray();

      if (images.length > 0) {
        for (const img of images) {
          if (img.original?.r2Key) {
            await storage.removeObject(img.original.r2Key);
          }

          if (img.thumb?.r2Key) {
            await storage.removeObject(img.thumb.r2Key);
          }
        }

        const imageDeleteResult = await db.collection("places").deleteMany({
          projectId: projectObjectId,
          dataItemId: placeObjectId,
          type: "image",
        });

        if (imageDeleteResult.deletedCount > 0) {
          summary.push(
            `${imageDeleteResult.deletedCount} gallery images removed`,
          );
        }
      }
    }

    if (wasGuestbookEnabled && !nextGuestbookEnabled) {
      const guestbookDeleteResult = await db.collection("places").deleteOne({
        projectId: projectObjectId,
        dataItemId: placeObjectId,
        type: "guestbook",
      });

      if (guestbookDeleteResult.deletedCount === 1) {
        summary.push("Guestbook removed");
      }
    }

    const now = new Date();

    const updateResult = await db.collection("places").findOneAndUpdate(
      {
        projectId: projectObjectId,
        _id: placeObjectId,
        type: "place",
      },
      {
        $set: {
          extensions: safeExtensions,
          updatedAt: now,
        },
      },
      {
        returnDocument: "after",
      },
    );

    const updatedPlace = updateResult?.value;

    if (!updatedPlace) {
      return res
        .status(404)
        .json({ error: "Place not found or unauthorized." });
    }

    summary.push("Place extensions updated");

    return res.json({
      message: summary.join("\n"),
      data: {
        _id: updatedPlace._id,
        updatedAt: updatedPlace.updatedAt,
      },
    });
  } catch (err) {
    console.error("Toggle extensions failed:", err);
    return res.status(500).json({
      error: "Failed to update place extensions",
    });
  }
});

export default router;
