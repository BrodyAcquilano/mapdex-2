// server/routes/motion.js

import express from "express";
import { smallJson, mediumJson } from "../middleware/bodyLimits.js";
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
} from "../../shared/validation/dataValidation.js";

import { buildDataItemFieldsFromForm } from "../utils/dataUtils.js";

const router = express.Router();

/* ─────────────────────────────
   POST - Get All motion records
───────────────────────────── */
router.post("/get", smallJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["projectId"])) {
    return res.status(400).json({
      error: "Invalid get motion payload.",
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

    const motionRecords = await db
      .collection("motion")
      .find({
        projectId: projectObjectId,
        type: "motion",
      })
      .toArray();

    if (motionRecords.length === 0) {
      return res.json({
        message: "No motion records found",
        data: [],
      });
    }

    const safeMotionRecords = motionRecords.map((motion) => {
      const safeMotion = {
        ...motion,
        userRole: getDataItemUserRole(motion, userId, access),
      };

      delete safeMotion.projectOwnerId;
      delete safeMotion.createdByUserId;

      return safeMotion;
    });

    return res.json({
      message: "Motion records retrieved",
      data: safeMotionRecords,
    });
  } catch (err) {
    console.error("Fetch motion failed:", err);
    return res.status(500).json({ error: "Failed to fetch motion records" });
  }
});

/* ─────────────────────────────
   POST - Get One motion record
───────────────────────────── */
router.post("/get/:_id", smallJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["projectId"])) {
    return res.status(400).json({
      error: "Invalid get motion record payload.",
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
    const motionObjectId = new ObjectId(_id);

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
        .json({ error: "Motion record not found or unauthorized." });
    }

    const motion = await db.collection("motion").findOne({
      projectId: projectObjectId,
      _id: motionObjectId,
      type: "motion",
    });

    if (!motion) {
      return res
        .status(404)
        .json({ error: "Motion record not found or unauthorized." });
    }

    const safeMotion = {
      ...motion,
      userRole: getDataItemUserRole(motion, userId, access),
    };

    delete safeMotion.projectOwnerId;
    delete safeMotion.createdByUserId;

    return res.json({
      message: "Motion record retrieved",
      data: safeMotion,
    });
  } catch (err) {
    console.error("Fetch one motion failed:", err);
    return res.status(500).json({ error: "Failed to fetch motion record" });
  }
});

/* ─────────────────────────────
   POST - Add motion record
───────────────────────────── */
router.post("/add", mediumJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["projectId", "schemaUpdatedAt", "motion"])) {
    return res.status(400).json({
      error: "Invalid add motion payload.",
    });
  }

  const { projectId, schemaUpdatedAt, motion } = req.body;

  if (!projectId || !schemaUpdatedAt || !motion) {
    return res
      .status(400)
      .json({ error: "Missing projectId, schemaUpdatedAt, or motion." });
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

    const existingMotionRecords = await db
      .collection("motion")
      .find({
        projectId: projectObjectId,
        type: "motion",
      })
      .toArray();

    if (existingMotionRecords.length >= PROJECT_LIMITS.maxDataItems) {
      return res.status(400).json({
        error: `This project has reached the maximum of ${PROJECT_LIMITS.maxDataItems} motion records.`,
      });
    }

    const validation = validateDataItemPayload({
      schema: project,
      dataItem: motion,
      mode: "add",
    });

    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.error || "Invalid motion payload.",
      });
    }

    const layer = Number(motion.layer);

    if (layer !== 1) {
      return res.status(400).json({
        error: "Motion records only support layer 1.",
      });
    }

    if (motion.parentDataItemId != null) {
      return res.status(400).json({
        error: "Motion records cannot have a parent data item.",
      });
    }

    const safeMotion = buildDataItemFieldsFromForm(project, motion, {
      includeExtensions: true,
    });

    if (!safeMotion) {
      return res.status(400).json({ error: "Invalid motion payload." });
    }

    safeMotion.sections = normalizeTagListSections(
      project.sections,
      safeMotion.sections,
    );

    safeMotion.sections = normalizePriceRangeSections(
      project.sections,
      safeMotion.sections,
    );

    const now = new Date();

    const insertDoc = {
      projectId: projectObjectId,
      projectOwnerId: project.projectOwnerId,
      createdByUserId: userId,
      type: "motion",
      layer,
      geometry: safeMotion.geometry,
      time: safeMotion.time,
      sections: safeMotion.sections,
      extensions: safeMotion.extensions,
      createdAt: now,
      updatedAt: now,
    };

    const prospectiveMotionRecords = [...existingMotionRecords, insertDoc];

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
      prospectiveMotionRecords,
    );

    const result = await db.collection("motion").insertOne(insertDoc);

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

    const safeInsertedMotion = {
      _id: result.insertedId,
      ...insertDoc,
    };

    delete safeInsertedMotion.projectOwnerId;
    delete safeInsertedMotion.createdByUserId;

    return res.status(201).json({
      message: "Motion record added",
      data: safeInsertedMotion,
      schemaUpdatedAt: schemaUpdatedAtResult,
      addedCustomTags,
      addedCustomCategories,
      removedCustomCategories,
      addedCustomUnits,
      removedCustomUnits,
    });
  } catch (err) {
    console.error("Insert motion failed:", err);

    if (err?.status === 400) {
      return res.status(400).json({
        error: err.message || "Invalid tag list or price range data.",
      });
    }

    return res.status(500).json({ error: "Failed to add motion record" });
  }
});

/* ─────────────────────────────
   PUT - Update motion record
───────────────────────────── */
router.put("/update/:_id", mediumJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["projectId", "schemaUpdatedAt", "motion"])) {
    return res.status(400).json({
      error: "Invalid update motion payload.",
    });
  }

  const { projectId, schemaUpdatedAt, motion } = req.body;
  const { _id } = req.params;

  if (!projectId || !schemaUpdatedAt || !motion || !_id) {
    return res
      .status(400)
      .json({ error: "Missing projectId, schemaUpdatedAt, motion, or _id." });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);
    const motionObjectId = new ObjectId(_id);

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
        .json({ error: "Motion record not found or unauthorized." });
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

    const existingMotion = await db.collection("motion").findOne({
      projectId: projectObjectId,
      _id: motionObjectId,
      type: "motion",
    });

    if (!existingMotion) {
      return res
        .status(404)
        .json({ error: "Motion record not found or unauthorized." });
    }

    const canEditAny = access.isAdmin;
    const isCreatedByUser =
      String(existingMotion.createdByUserId || "") === String(userId);

    if (!canEditAny && !isCreatedByUser) {
      return res.status(403).json({
        error: "Editors can only update motion records they created.",
      });
    }

    const validation = validateDataItemPayload({
      schema: project,
      dataItem: motion,
      mode: "update",
    });

    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.error || "Invalid motion payload.",
      });
    }

    if (String(motion._id) !== String(_id)) {
      return res.status(400).json({
        error: "Invalid motion payload.",
      });
    }

    const incomingMotionUpdatedAt = new Date(motion.updatedAt);
    const databaseMotionUpdatedAt = new Date(existingMotion.updatedAt);

    if (
      !Number.isFinite(incomingMotionUpdatedAt.getTime()) ||
      !Number.isFinite(databaseMotionUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid motion timestamp. Reload before updating.",
      });
    }

    if (
      incomingMotionUpdatedAt.getTime() !== databaseMotionUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This motion record has changed since you loaded it. Reload before updating.",
      });
    }

    const safeMotion = buildDataItemFieldsFromForm(
      project,
      motion,
      {
        includeExtensions: false,
        existingGeometry: existingMotion.geometry,
      },
    );

    if (!safeMotion) {
      return res.status(400).json({
        error: "Invalid motion payload.",
      });
    }

    safeMotion.sections = normalizeTagListSections(
      project.sections,
      safeMotion.sections,
    );

    safeMotion.sections = normalizePriceRangeSections(
      project.sections,
      safeMotion.sections,
    );

    const now = new Date();

    const prospectiveUpdatedMotion = {
      ...existingMotion,
      ...safeMotion,
      updatedAt: now,
    };

    const otherMotionRecords = await db
      .collection("motion")
      .find({
        projectId: projectObjectId,
        type: "motion",
        _id: { $ne: motionObjectId },
      })
      .toArray();

    const prospectiveMotionRecords = [
      ...otherMotionRecords,
      prospectiveUpdatedMotion,
    ];

    const { nextSections: tagMergedSections, addedCustomTags } =
      mergeTagsIntoProjectSections(
        project.sections,
        prospectiveUpdatedMotion.sections,
      );

    const { nextSections: tagCleanedSections, removedCustomTags } =
      removeUnusedCustomTagsAfterDataItemUpdate(
        tagMergedSections,
        existingMotion.sections,
        prospectiveUpdatedMotion.sections,
        otherMotionRecords,
      );

    const {
      nextSections,
      addedCustomCategories,
      removedCustomCategories,
      addedCustomUnits,
      removedCustomUnits,
    } = recomputeProjectPriceSections(
      tagCleanedSections,
      prospectiveMotionRecords,
    );

    const updateResult = await db.collection("motion").findOneAndUpdate(
      {
        projectId: projectObjectId,
        _id: motionObjectId,
        type: "motion",
      },
      {
        $set: {
          ...safeMotion,
          updatedAt: now,
        },
      },
      {
        returnDocument: "after",
      },
    );

    const updatedMotion = updateResult?.value;

    if (!updatedMotion) {
      return res
        .status(404)
        .json({ error: "Motion record not found or unauthorized." });
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

    const safeUpdatedMotion = { ...updatedMotion };

    delete safeUpdatedMotion.projectOwnerId;
    delete safeUpdatedMotion.createdByUserId;

    return res.json({
      message: "Motion record updated",
      data: safeUpdatedMotion,
      schemaUpdatedAt: schemaUpdatedAtResult,
      addedCustomTags,
      removedCustomTags,
      addedCustomCategories,
      removedCustomCategories,
      addedCustomUnits,
      removedCustomUnits,
    });
  } catch (err) {
    console.error("Update motion failed:", err);

    if (err?.status === 400) {
      return res.status(400).json({
        error: err.message || "Invalid tag list or price range data.",
      });
    }

    return res.status(500).json({ error: "Failed to update motion record" });
  }
});

/* ─────────────────────────────
   DELETE - Remove motion record
───────────────────────────── */
router.delete("/remove/:_id", smallJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["projectId", "schemaUpdatedAt", "updatedAt"])) {
    return res.status(400).json({
      error: "Invalid remove motion payload.",
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
    const motionObjectId = new ObjectId(_id);

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
        error: "Motion record not found or unauthorized.",
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

    const existingMotion = await db.collection("motion").findOne({
      projectId: projectObjectId,
      _id: motionObjectId,
      type: "motion",
    });

    if (!existingMotion) {
      return res.status(404).json({
        error: "Motion record not found or unauthorized.",
      });
    }

    const canEditAny = access.isAdmin;
    const isCreatedByUser =
      String(existingMotion.createdByUserId || "") === String(userId);

    if (!canEditAny && !isCreatedByUser) {
      return res.status(403).json({
        error: "Editors can only delete motion records they created.",
      });
    }

    const incomingMotionUpdatedAt = new Date(updatedAt);
    const databaseMotionUpdatedAt = new Date(existingMotion.updatedAt);

    if (
      !Number.isFinite(incomingMotionUpdatedAt.getTime()) ||
      !Number.isFinite(databaseMotionUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid motion timestamp. Reload before deleting.",
      });
    }

    if (
      incomingMotionUpdatedAt.getTime() !== databaseMotionUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This motion record has changed since you loaded it. Reload before deleting.",
      });
    }

    const summary = [];

    const images = await db
      .collection("motion")
      .find({
        projectId: projectObjectId,
        dataItemId: motionObjectId,
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

      const imageDeleteResult = await db.collection("motion").deleteMany({
        projectId: projectObjectId,
        dataItemId: motionObjectId,
        type: "image",
      });

      if (imageDeleteResult.deletedCount > 0) {
        summary.push(`${imageDeleteResult.deletedCount} gallery images removed`);
      }
    }

    const motionDeleteResult = await db.collection("motion").deleteOne({
      projectId: projectObjectId,
      _id: motionObjectId,
      type: "motion",
    });

    if (motionDeleteResult.deletedCount !== 1) {
      return res.status(404).json({
        error: "Motion record not found or unauthorized.",
      });
    }

    summary.push("Motion record removed");

    const remainingMotionRecords = await db
      .collection("motion")
      .find({
        projectId: projectObjectId,
        type: "motion",
      })
      .toArray();

    const { nextSections: tagRecomputedSections, removedCustomTags } =
      recomputeProjectTagSections(project.sections, remainingMotionRecords);

    const {
      nextSections,
      addedCustomCategories,
      removedCustomCategories,
      addedCustomUnits,
      removedCustomUnits,
    } = recomputeProjectPriceSections(
      tagRecomputedSections,
      remainingMotionRecords,
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
    console.error("Delete motion failed:", err);

    if (err?.status === 400) {
      return res.status(400).json({
        error: err.message || "Invalid tag list or price range data.",
      });
    }

    return res.status(500).json({
      error: "Failed to remove motion record",
    });
  }
});

/* ─────────────────────────────
   PUT - Toggle Motion Extensions
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
      error: "Invalid toggle motion extensions payload.",
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
    const motionObjectId = new ObjectId(_id);

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
        .json({ error: "Motion record not found or unauthorized." });
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

    const existingMotion = await db.collection("motion").findOne({
      projectId: projectObjectId,
      _id: motionObjectId,
      type: "motion",
    });

    if (!existingMotion) {
      return res
        .status(404)
        .json({ error: "Motion record not found or unauthorized." });
    }

    const canEditAny = access.isAdmin;
    const isCreatedByUser =
      String(existingMotion.createdByUserId || "") === String(userId);

    if (!canEditAny && !isCreatedByUser) {
      return res.status(403).json({
        error:
          "Editors can only update extensions for motion records they created.",
      });
    }

    const incomingUpdatedAt = new Date(updatedAt);
    const databaseUpdatedAt = new Date(existingMotion.updatedAt);

    if (
      !Number.isFinite(incomingUpdatedAt.getTime()) ||
      !Number.isFinite(databaseUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid motion timestamp. Reload before updating extensions.",
      });
    }

    if (incomingUpdatedAt.getTime() !== databaseUpdatedAt.getTime()) {
      return res.status(409).json({
        error:
          "This motion record has changed since you loaded it. Reload before updating extensions.",
      });
    }

    if (!validateExtensionsPayload(project, extensions)) {
      return res.status(400).json({
        error: "Invalid extensions.",
      });
    }

    const safeExtensions = structuredClone(extensions);

    const wasGalleryEnabled = existingMotion.extensions?.Gallery === true;
    const nextGalleryEnabled = safeExtensions.Gallery === true;

    const summary = [];

    if (wasGalleryEnabled && !nextGalleryEnabled) {
      const images = await db
        .collection("motion")
        .find({
          projectId: projectObjectId,
          dataItemId: motionObjectId,
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

        const imageDeleteResult = await db.collection("motion").deleteMany({
          projectId: projectObjectId,
          dataItemId: motionObjectId,
          type: "image",
        });

        if (imageDeleteResult.deletedCount > 0) {
          summary.push(
            `${imageDeleteResult.deletedCount} gallery images removed`,
          );
        }
      }
    }

    const now = new Date();

    const updateResult = await db.collection("motion").findOneAndUpdate(
      {
        projectId: projectObjectId,
        _id: motionObjectId,
        type: "motion",
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

    const updatedMotion = updateResult?.value;

    if (!updatedMotion) {
      return res
        .status(404)
        .json({ error: "Motion record not found or unauthorized." });
    }

    summary.push("Motion extensions updated");

    return res.json({
      message: summary.join("\n"),
      data: {
        _id: updatedMotion._id,
        updatedAt: updatedMotion.updatedAt,
      },
    });
  } catch (err) {
    console.error("Toggle motion extensions failed:", err);
    return res.status(500).json({
      error: "Failed to update motion extensions",
    });
  }
});

export default router;