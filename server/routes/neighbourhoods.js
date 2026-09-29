// server/routes/neighbourhoods.js
import express from "express";
import { smallJson, mediumJson, importJson } from "../middleware/bodyLimits.js";
import { ObjectId } from "mongodb";
import { getDB } from "../db.js";
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
} from "../../shared/validation/dataValidation.js";

import { buildDataItemFieldsFromForm } from "../utils/dataUtils.js";
import { storage } from "../media/mediaService.js";

const router = express.Router();

/* ─────────────────────────────
   POST - Get All neighbourhoods
───────────────────────────── */
router.post("/get", smallJson, async (req, res) => {
    if (!hasExactKeys(req.body, ["projectId"])) {
    return res.status(400).json({
      error: "Invalid get neighbourhoods payload.",
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
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const access = hasProjectAccess(project, userId, "viewer");

    if (!access.hasAccess) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const neighbourhoods = await db
      .collection("neighbourhoods")
      .find({
        projectId: projectObjectId,
        type: "neighbourhood",
      })
      .toArray();

    if (neighbourhoods.length === 0) {
      return res.json({
        message: "No neighbourhoods found",
        data: [],
      });
    }

    const safeNeighbourhoods = neighbourhoods.map((neighbourhood) => {
      const safeNeighbourhood = {
        ...neighbourhood,
        userRole: getDataItemUserRole(neighbourhood, userId, access),
      };

      delete safeNeighbourhood.projectOwnerId;
      delete safeNeighbourhood.createdByUserId;

      return safeNeighbourhood;
    });

    return res.json({
      message: "Neighbourhoods retrieved",
      data: safeNeighbourhoods,
    });
  } catch (err) {
    console.error("Fetch failed:", err);
    return res.status(500).json({
      error: "Failed to fetch neighbourhoods",
    });
  }
});

/* ─────────────────────────────
   POST - Get One neighbourhood
───────────────────────────── */
router.post("/get/:_id", smallJson, async (req, res) => {
   if (!hasExactKeys(req.body, ["projectId"])) {
    return res.status(400).json({
      error: "Invalid get neighbourhood payload.",
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
    const neighbourhoodObjectId = new ObjectId(_id);

    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const access = hasProjectAccess(project, userId, "viewer");

    if (!access.hasAccess) {
      return res.status(404).json({
        error: "Neighbourhood not found or unauthorized.",
      });
    }

    const neighbourhood = await db.collection("neighbourhoods").findOne({
      projectId: projectObjectId,
      _id: neighbourhoodObjectId,
      type: "neighbourhood",
    });

    if (!neighbourhood) {
      return res.status(404).json({
        error: "Neighbourhood not found or unauthorized.",
      });
    }

    const safeNeighbourhood = {
      ...neighbourhood,
      userRole: getDataItemUserRole(neighbourhood, userId, access),
    };

    delete safeNeighbourhood.projectOwnerId;
    delete safeNeighbourhood.createdByUserId;

    return res.json({
      message: "Neighbourhood retrieved",
      data: safeNeighbourhood,
    });
  } catch (err) {
    console.error("Fetch one failed:", err);
    return res.status(500).json({
      error: "Failed to fetch neighbourhood",
    });
  }
});

/* ─────────────────────────────
   POST - Add neighbourhood
───────────────────────────── */
router.post("/add", mediumJson, async (req, res) => {
    if (
    !hasExactKeys(req.body, [
      "projectId",
      "schemaUpdatedAt",
      "neighbourhood",
    ])
  ) {
    return res.status(400).json({
      error: "Invalid add neighbourhood payload.",
    });
  }

  const { projectId, schemaUpdatedAt, neighbourhood } = req.body;

  if (!projectId || !schemaUpdatedAt || !neighbourhood) {
    return res.status(400).json({
      error: "Missing projectId, schemaUpdatedAt, or neighbourhood.",
    });
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

    if (incomingSchemaUpdatedAt.getTime() !== databaseSchemaUpdatedAt.getTime()) {
      return res.status(409).json({
        error:
          "This project's schema has changed since you loaded it. Reload before adding.",
      });
    }

    const existingNeighbourhoods = await db
      .collection("neighbourhoods")
      .find({
        projectId: projectObjectId,
        type: "neighbourhood",
      })
      .toArray();

    if (existingNeighbourhoods.length >= PROJECT_LIMITS.maxDataItems) {
      return res.status(400).json({
        error: `This project has reached the maximum of ${PROJECT_LIMITS.maxDataItems} neighbourhoods.`,
      });
    }

    const validation = validateDataItemPayload({
      schema: project,
      dataItem: neighbourhood,
      mode: "add",
    });

    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.error || "Invalid neighbourhood payload.",
      });
    }

    const layer = Number(neighbourhood.layer);
    let parentDataItemId = null;

    if (layer === 2) {
      if (!ObjectId.isValid(neighbourhood.parentDataItemId)) {
        return res.status(400).json({
          error: "Invalid parent data item.",
        });
      }

      parentDataItemId = new ObjectId(neighbourhood.parentDataItemId);

      const parentNeighbourhood = await db.collection("neighbourhoods").findOne({
        projectId: projectObjectId,
        _id: parentDataItemId,
        type: "neighbourhood",
        layer: 1,
      });

      if (!parentNeighbourhood) {
        return res.status(400).json({
          error: "Invalid parent data item.",
        });
      }
    }

    const safeNeighbourhood = buildDataItemFieldsFromForm(
      project,
      neighbourhood,
      {
        includeExtensions: true,
      },
    );

    if (!safeNeighbourhood) {
      return res.status(400).json({
        error: "Invalid neighbourhood payload.",
      });
    }

    safeNeighbourhood.sections = normalizeTagListSections(
      project.sections,
      safeNeighbourhood.sections,
    );

    safeNeighbourhood.sections = normalizePriceRangeSections(
      project.sections,
      safeNeighbourhood.sections,
    );

    const now = new Date();

    const insertDoc =
      layer === 2
        ? {
            projectId: projectObjectId,
            projectOwnerId: project.projectOwnerId,
            createdByUserId: userId,
            type: "neighbourhood",
            layer,
            parentDataItemId,
            geometry: safeNeighbourhood.geometry,
            time: safeNeighbourhood.time,
            sections: safeNeighbourhood.sections,
            extensions: safeNeighbourhood.extensions,
            createdAt: now,
            updatedAt: now,
          }
        : {
            projectId: projectObjectId,
            projectOwnerId: project.projectOwnerId,
            createdByUserId: userId,
            type: "neighbourhood",
            layer,
            geometry: safeNeighbourhood.geometry,
            time: safeNeighbourhood.time,
            sections: safeNeighbourhood.sections,
            extensions: safeNeighbourhood.extensions,
            createdAt: now,
            updatedAt: now,
          };

    const prospectiveNeighbourhoods = [...existingNeighbourhoods, insertDoc];

    const { nextSections: tagMergedSections, addedCustomTags } =
      mergeTagsIntoProjectSections(project.sections, insertDoc.sections);

    const {
      nextSections,
      addedCustomCategories,
      removedCustomCategories,
      addedCustomUnits,
      removedCustomUnits,
    } = recomputeProjectPriceSections(
      tagMergedSections,
      prospectiveNeighbourhoods,
    );

    const result = await db.collection("neighbourhoods").insertOne(insertDoc);

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

    const safeInsertedNeighbourhood = {
      _id: result.insertedId,
      ...insertDoc,
    };

    delete safeInsertedNeighbourhood.projectOwnerId;
    delete safeInsertedNeighbourhood.createdByUserId;

    return res.status(201).json({
      message: "Neighbourhood added",
      data: safeInsertedNeighbourhood,
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

    return res.status(500).json({ error: "Failed to add neighbourhood" });
  }
});

/* ─────────────────────────────
   POST - Add neighbourhood batch
───────────────────────────── */
router.post("/add-batch", importJson, async (req, res) => {
    if (!hasExactKeys(req.body, ["projectId", "neighbourhoods"])) {
    return res.status(400).json({
      error: "Invalid add neighbourhood batch payload.",
    });
  }

  const { projectId, neighbourhoods } = req.body;

  if (
    !projectId ||
    !Array.isArray(neighbourhoods) ||
    neighbourhoods.length === 0
  ) {
    return res.status(400).json({
      error: "Missing projectId or neighbourhoods.",
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

    const existingNeighbourhoodCount = await db
      .collection("neighbourhoods")
      .countDocuments({
        projectId: projectObjectId,
        type: "neighbourhood",
      });

    const nextNeighbourhoodCount =
      existingNeighbourhoodCount + neighbourhoods.length;

    if (nextNeighbourhoodCount > PROJECT_LIMITS.maxDataItems) {
      return res.status(400).json({
        error:
          `This project has reached the maximum of ${PROJECT_LIMITS.maxDataItems} neighbourhoods. ` +
          `You currently have ${existingNeighbourhoodCount}, and this import would add ${neighbourhoods.length}.`,
      });
    }

    const safeNeighbourhoods = [];

    for (let i = 0; i < neighbourhoods.length; i += 1) {
      const neighbourhood = neighbourhoods[i];

      const validation = validateDataItemPayload({
        schema: project,
        dataItem: neighbourhood,
        mode: "add",
      });

      if (!validation.isValid) {
        return res.status(400).json({
          error: `Invalid neighbourhood payload at index ${i}.`,
        });
      }

      const layer = Number(neighbourhood.layer);
      let parentDataItemId = null;

      if (layer === 2) {
        if (!ObjectId.isValid(neighbourhood.parentDataItemId)) {
          return res.status(400).json({
            error: `Invalid parent data item at index ${i}.`,
          });
        }

        parentDataItemId = new ObjectId(neighbourhood.parentDataItemId);

        const parentNeighbourhood = await db
          .collection("neighbourhoods")
          .findOne({
            projectId: projectObjectId,
            _id: parentDataItemId,
            type: "neighbourhood",
            layer: 1,
          });

        if (!parentNeighbourhood) {
          return res.status(400).json({
            error: `Invalid parent data item at index ${i}.`,
          });
        }
      }

      const safeNeighbourhood = buildDataItemFieldsFromForm(
        project,
        neighbourhood,
        {
          includeExtensions: true,
        },
      );

      if (!safeNeighbourhood) {
        return res.status(400).json({
          error: `Invalid neighbourhood payload at index ${i}.`,
        });
      }

      safeNeighbourhood.sections = normalizeTagListSections(
        project.sections,
        safeNeighbourhood.sections,
      );

      safeNeighbourhood.sections = normalizePriceRangeSections(
        project.sections,
        safeNeighbourhood.sections,
      );

      const insertDoc =
        layer === 2
          ? {
              projectId: projectObjectId,
              projectOwnerId: project.projectOwnerId,
              createdByUserId: userId,
              type: "neighbourhood",
              layer,
              parentDataItemId,
              geometry: safeNeighbourhood.geometry,
              time: safeNeighbourhood.time,
              sections: safeNeighbourhood.sections,
              extensions: safeNeighbourhood.extensions,
              createdAt: now,
              updatedAt: now,
            }
          : {
              projectId: projectObjectId,
              projectOwnerId: project.projectOwnerId,
              createdByUserId: userId,
              type: "neighbourhood",
              layer,
              geometry: safeNeighbourhood.geometry,
              time: safeNeighbourhood.time,
              sections: safeNeighbourhood.sections,
              extensions: safeNeighbourhood.extensions,
              createdAt: now,
              updatedAt: now,
            };

      safeNeighbourhoods.push(insertDoc);
    }

    const result = await db
      .collection("neighbourhoods")
      .insertMany(safeNeighbourhoods);

    const insertedIds = Object.values(result.insertedIds).map((_id) => ({
      _id,
    }));

    return res.status(201).json({
      message: `${insertedIds.length} neighbourhood polygons added`,
      data: {
        insertedIds,
        count: insertedIds.length,
      },
    });
  } catch (err) {
    console.error("Batch insert failed:", err);

    if (err?.status === 400) {
      return res.status(400).json({
        error: err.message || "Invalid tag list or price range data.",
      });
    }

    return res.status(500).json({
      error: "Failed to add neighbourhood batch",
    });
  }
});

/* ─────────────────────────────
   PUT - Update neighbourhood
───────────────────────────── */
router.put("/update/:_id", mediumJson, async (req, res) => {
   if (
    !hasExactKeys(req.body, [
      "projectId",
      "schemaUpdatedAt",
      "neighbourhood",
    ])
  ) {
    return res.status(400).json({
      error: "Invalid update neighbourhood payload.",
    });
  }

  const { projectId, schemaUpdatedAt, neighbourhood } = req.body;
  const { _id } = req.params;

  if (!projectId || !schemaUpdatedAt || !neighbourhood || !_id) {
    return res.status(400).json({
      error: "Missing projectId, schemaUpdatedAt, neighbourhood, or _id.",
    });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);
    const neighbourhoodObjectId = new ObjectId(_id);

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
        .json({ error: "Neighbourhood not found or unauthorized." });
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

    if (incomingSchemaUpdatedAt.getTime() !== databaseSchemaUpdatedAt.getTime()) {
      return res.status(409).json({
        error:
          "This project's schema has changed since you loaded it. Reload before updating.",
      });
    }

    const existingNeighbourhood = await db
      .collection("neighbourhoods")
      .findOne({
        projectId: projectObjectId,
        _id: neighbourhoodObjectId,
        type: "neighbourhood",
      });

    if (!existingNeighbourhood) {
      return res
        .status(404)
        .json({ error: "Neighbourhood not found or unauthorized." });
    }

    const canEditAny = access.isAdmin;
    const isCreatedByUser =
      String(existingNeighbourhood.createdByUserId || "") === String(userId);

    if (!canEditAny && !isCreatedByUser) {
      return res.status(403).json({
        error: "Editors can only update neighbourhoods they created.",
      });
    }

    const validation = validateDataItemPayload({
      schema: project,
      dataItem: neighbourhood,
      mode: "update",
    });

    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.error || "Invalid neighbourhood payload.",
      });
    }

    if (String(neighbourhood._id) !== String(_id)) {
      return res.status(400).json({
        error: "Invalid neighbourhood payload.",
      });
    }

    const incomingNeighbourhoodUpdatedAt = new Date(neighbourhood.updatedAt);
    const databaseNeighbourhoodUpdatedAt = new Date(
      existingNeighbourhood.updatedAt,
    );

    if (
      !Number.isFinite(incomingNeighbourhoodUpdatedAt.getTime()) ||
      !Number.isFinite(databaseNeighbourhoodUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid neighbourhood timestamp. Reload before updating.",
      });
    }

    if (
      incomingNeighbourhoodUpdatedAt.getTime() !==
      databaseNeighbourhoodUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This neighbourhood has changed since you loaded it. Reload before updating.",
      });
    }

    const safeNeighbourhood = buildDataItemFieldsFromForm(
      project,
      neighbourhood,
      {
        includeExtensions: false,
        existingGeometry: existingNeighbourhood.geometry,
      },
    );

    if (!safeNeighbourhood) {
      return res.status(400).json({
        error: "Invalid neighbourhood payload.",
      });
    }

    safeNeighbourhood.sections = normalizeTagListSections(
      project.sections,
      safeNeighbourhood.sections,
    );

    safeNeighbourhood.sections = normalizePriceRangeSections(
      project.sections,
      safeNeighbourhood.sections,
    );

    const now = new Date();

    const prospectiveUpdatedNeighbourhood = {
      ...existingNeighbourhood,
      ...safeNeighbourhood,
      updatedAt: now,
    };

    const otherNeighbourhoods = await db
      .collection("neighbourhoods")
      .find({
        projectId: projectObjectId,
        type: "neighbourhood",
        _id: { $ne: neighbourhoodObjectId },
      })
      .toArray();

    const prospectiveNeighbourhoods = [
      ...otherNeighbourhoods,
      prospectiveUpdatedNeighbourhood,
    ];

    const { nextSections: tagMergedSections, addedCustomTags } =
      mergeTagsIntoProjectSections(
        project.sections,
        prospectiveUpdatedNeighbourhood.sections,
      );

    const { nextSections: tagCleanedSections, removedCustomTags } =
      removeUnusedCustomTagsAfterDataItemUpdate(
        tagMergedSections,
        existingNeighbourhood.sections,
        prospectiveUpdatedNeighbourhood.sections,
        otherNeighbourhoods,
      );

    const {
      nextSections,
      addedCustomCategories,
      removedCustomCategories,
      addedCustomUnits,
      removedCustomUnits,
    } = recomputeProjectPriceSections(
      tagCleanedSections,
      prospectiveNeighbourhoods,
    );

    const updateResult = await db.collection("neighbourhoods").findOneAndUpdate(
      {
        projectId: projectObjectId,
        _id: neighbourhoodObjectId,
        type: "neighbourhood",
      },
      {
        $set: {
          ...safeNeighbourhood,
          updatedAt: now,
        },
      },
      {
        returnDocument: "after",
      },
    );

    const updatedNeighbourhood = updateResult?.value;

    if (!updatedNeighbourhood) {
      return res
        .status(404)
        .json({ error: "Neighbourhood not found or unauthorized." });
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

    const safeUpdatedNeighbourhood = { ...updatedNeighbourhood };

    delete safeUpdatedNeighbourhood.projectOwnerId;
    delete safeUpdatedNeighbourhood.createdByUserId;

    return res.json({
      message: "Neighbourhood updated",
      data: safeUpdatedNeighbourhood,
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

    return res.status(500).json({ error: "Failed to update neighbourhood" });
  }
});

/* ─────────────────────────────
   DELETE - Remove neighbourhood
───────────────────────────── */
router.delete("/remove/:_id", smallJson, async (req, res) => {
    if (!hasExactKeys(req.body, ["projectId", "schemaUpdatedAt", "updatedAt"])) {
    return res.status(400).json({
      error: "Invalid remove neighbourhood payload.",
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
    const neighbourhoodObjectId = new ObjectId(_id);

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
        error: "Neighbourhood not found or unauthorized.",
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

    if (incomingSchemaUpdatedAt.getTime() !== databaseSchemaUpdatedAt.getTime()) {
      return res.status(409).json({
        error:
          "This project's schema has changed since you loaded it. Reload before deleting.",
      });
    }

    const existingNeighbourhood = await db
      .collection("neighbourhoods")
      .findOne({
        projectId: projectObjectId,
        _id: neighbourhoodObjectId,
        type: "neighbourhood",
      });

    if (!existingNeighbourhood) {
      return res.status(404).json({
        error: "Neighbourhood not found or unauthorized.",
      });
    }

    const canEditAny = access.isAdmin;
    const isCreatedByUser =
      String(existingNeighbourhood.createdByUserId || "") === String(userId);

    if (!canEditAny && !isCreatedByUser) {
      return res.status(403).json({
        error: "Editors can only delete neighbourhoods they created.",
      });
    }

    const incomingNeighbourhoodUpdatedAt = new Date(updatedAt);
    const databaseNeighbourhoodUpdatedAt = new Date(
      existingNeighbourhood.updatedAt,
    );

    if (
      !Number.isFinite(incomingNeighbourhoodUpdatedAt.getTime()) ||
      !Number.isFinite(databaseNeighbourhoodUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid neighbourhood timestamp. Reload before deleting.",
      });
    }

    if (
      incomingNeighbourhoodUpdatedAt.getTime() !==
      databaseNeighbourhoodUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This neighbourhood has changed since you loaded it. Reload before deleting.",
      });
    }

    const summary = [];

    async function removeNeighbourhoodExtensionData(dataItemId) {
      const extensionSummary = [];

      /* ─────────────────────────────
         Remove Gallery Images
      ───────────────────────────── */
      const images = await db
        .collection("neighbourhoods")
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

        const imageDeleteResult = await db
          .collection("neighbourhoods")
          .deleteMany({
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
      const guestbookResult = await db.collection("neighbourhoods").deleteOne({
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
       Remove Layer 2 Child Neighbourhoods First
    ───────────────────────────── */
    if (Number(existingNeighbourhood.layer) === 1) {
      const childNeighbourhoods = await db
        .collection("neighbourhoods")
        .find({
          projectId: projectObjectId,
          type: "neighbourhood",
          layer: 2,
          parentDataItemId: neighbourhoodObjectId,
        })
        .toArray();

      if (childNeighbourhoods.length > 0) {
        for (const childNeighbourhood of childNeighbourhoods) {
          await removeNeighbourhoodExtensionData(childNeighbourhood._id);
        }

        const childDeleteResult = await db
          .collection("neighbourhoods")
          .deleteMany({
            projectId: projectObjectId,
            type: "neighbourhood",
            layer: 2,
            parentDataItemId: neighbourhoodObjectId,
          });

        if (childDeleteResult.deletedCount > 0) {
          summary.push(
            `${childDeleteResult.deletedCount} layer 2 neighbourhoods removed`,
          );
        }
      }
    }

    /* ─────────────────────────────
       Remove Target Neighbourhood Extension Data
    ───────────────────────────── */
    const targetExtensionSummary =
      await removeNeighbourhoodExtensionData(neighbourhoodObjectId);
    summary.push(...targetExtensionSummary);

    /* ─────────────────────────────
       Remove Target Neighbourhood
    ───────────────────────────── */
    const deleteResult = await db.collection("neighbourhoods").deleteOne({
      projectId: projectObjectId,
      _id: neighbourhoodObjectId,
      type: "neighbourhood",
    });

    if (deleteResult.deletedCount !== 1) {
      return res.status(404).json({
        error: "Neighbourhood not found or unauthorized.",
      });
    }

    summary.push("Neighbourhood removed");

    const remainingNeighbourhoods = await db
      .collection("neighbourhoods")
      .find({
        projectId: projectObjectId,
        type: "neighbourhood",
      })
      .toArray();

    const { nextSections: tagRecomputedSections, removedCustomTags } =
      recomputeProjectTagSections(project.sections, remainingNeighbourhoods);

    const {
      nextSections,
      addedCustomCategories,
      removedCustomCategories,
      addedCustomUnits,
      removedCustomUnits,
    } = recomputeProjectPriceSections(
      tagRecomputedSections,
      remainingNeighbourhoods,
    );

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
      error: "Failed to remove neighbourhood",
    });
  }
});

/* ─────────────────────────────
   PUT - Toggle Neighbourhood Extensions
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
      error: "Invalid toggle neighbourhood extensions payload.",
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
    const neighbourhoodObjectId = new ObjectId(_id);

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
        .json({ error: "Neighbourhood not found or unauthorized." });
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

    if (incomingSchemaUpdatedAt.getTime() !== databaseSchemaUpdatedAt.getTime()) {
      return res.status(409).json({
        error:
          "This project's schema has changed since you loaded it. Reload before updating extensions.",
      });
    }

    const existingNeighbourhood = await db
      .collection("neighbourhoods")
      .findOne({
        projectId: projectObjectId,
        _id: neighbourhoodObjectId,
        type: "neighbourhood",
      });

    if (!existingNeighbourhood) {
      return res
        .status(404)
        .json({ error: "Neighbourhood not found or unauthorized." });
    }

    const canEditAny = access.isAdmin;
    const isCreatedByUser =
      String(existingNeighbourhood.createdByUserId || "") === String(userId);

    if (!canEditAny && !isCreatedByUser) {
      return res.status(403).json({
        error:
          "Editors can only update extensions for neighbourhoods they created.",
      });
    }

    const incomingUpdatedAt = new Date(updatedAt);
    const databaseUpdatedAt = new Date(existingNeighbourhood.updatedAt);

    if (
      !Number.isFinite(incomingUpdatedAt.getTime()) ||
      !Number.isFinite(databaseUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error:
          "Invalid neighbourhood timestamp. Reload before updating extensions.",
      });
    }

    if (incomingUpdatedAt.getTime() !== databaseUpdatedAt.getTime()) {
      return res.status(409).json({
        error:
          "This neighbourhood has changed since you loaded it. Reload before updating extensions.",
      });
    }

    if (!validateExtensionsPayload(project, extensions)) {
      return res.status(400).json({
        error: "Invalid extensions.",
      });
    }

    const safeExtensions = structuredClone(extensions);

    const wasGalleryEnabled =
      existingNeighbourhood.extensions?.Gallery === true;

    const nextGalleryEnabled = safeExtensions.Gallery === true;

    const wasGuestbookEnabled =
      existingNeighbourhood.extensions?.Guestbook === true;

    const nextGuestbookEnabled = safeExtensions.Guestbook === true;

    const summary = [];

    if (wasGalleryEnabled && !nextGalleryEnabled) {
      const images = await db
        .collection("neighbourhoods")
        .find({
          projectId: projectObjectId,
          dataItemId: neighbourhoodObjectId,
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

        const imageDeleteResult = await db
          .collection("neighbourhoods")
          .deleteMany({
            projectId: projectObjectId,
            dataItemId: neighbourhoodObjectId,
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
      const guestbookDeleteResult = await db
        .collection("neighbourhoods")
        .deleteOne({
          projectId: projectObjectId,
          dataItemId: neighbourhoodObjectId,
          type: "guestbook",
        });

      if (guestbookDeleteResult.deletedCount === 1) {
        summary.push("Guestbook removed");
      }
    }

    const now = new Date();

    const updateResult = await db
      .collection("neighbourhoods")
      .findOneAndUpdate(
        {
          projectId: projectObjectId,
          _id: neighbourhoodObjectId,
          type: "neighbourhood",
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

    const updatedNeighbourhood = updateResult?.value;

    if (!updatedNeighbourhood) {
      return res
        .status(404)
        .json({ error: "Neighbourhood not found or unauthorized." });
    }

    summary.push("Neighbourhood extensions updated");

    return res.json({
      message: summary.join("\n"),
      data: {
        _id: updatedNeighbourhood._id,
        updatedAt: updatedNeighbourhood.updatedAt,
      },
    });
  } catch (err) {
    console.error("Toggle extensions failed:", err);
    return res.status(500).json({
      error: "Failed to update neighbourhood extensions",
    });
  }
});

export default router;