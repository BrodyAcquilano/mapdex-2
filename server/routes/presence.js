// server/routes/presence.js
import express from "express";
import { smallJson, mediumJson } from "../middleware/bodyLimits.js";
import { ObjectId } from "mongodb";
import { getDB } from "../db.js";
import { hasProjectAccess } from "../utils/projectPermissions.js";
import { getPresenceUserRole } from "../utils/dataItemPermissions.js";
import { PROJECT_LIMITS } from "../../shared/validation/validationConstants.js";
import {
  normalizeTagListSections,
  mergeTagsIntoProjectSections,
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
import { validatePresenceGetPayload } from "../../shared/validation/presenceSchemaMetaDataValidation.js";
import { removePresenceCascade } from "../utils/removePresenceCascade.js";
import { buildDataItemFieldsFromForm } from "../utils/dataUtils.js";
import { storage } from "../media/mediaService.js";

import { reapplyTimezoneFromLatLng } from "../../shared/time/reapplyTimezoneFromLatLng.js";

const router = express.Router();

const PRESENCE_CUSTOM_SCHEMA_DIFFS_ENABLED = false;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeSchemaString(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

function buildSchemaInputMaps(sections) {
  const tagMap = new Map();
  const categoryMap = new Map();
  const unitMap = new Map();

  for (const section of safeArray(sections)) {
    for (const input of safeArray(section?.inputs)) {
      const inputId = String(input?.id || "");
      if (!inputId) continue;

      if (input?.type === "tagList") {
        const customTags = safeArray(input?.customTags)
          .filter((tag) => typeof tag === "string")
          .map(normalizeSchemaString)
          .filter(Boolean);

        tagMap.set(inputId, customTags);
      }

      if (input?.type === "priceRangeArray") {
        const categories = safeArray(input?.customCategoryOptions)
          .filter((category) => typeof category === "string")
          .map(normalizeSchemaString)
          .filter(Boolean);

        categoryMap.set(inputId, categories);

        const rawUnitsByCategory = isPlainObject(
          input?.customUnitOptionsByCategory,
        )
          ? input.customUnitOptionsByCategory
          : {};

        const normalizedUnitsByCategory = {};

        for (const [rawCategory, rawUnits] of Object.entries(
          rawUnitsByCategory,
        )) {
          const category = normalizeSchemaString(rawCategory);
          if (!category) continue;

          const units = safeArray(rawUnits)
            .filter((unit) => typeof unit === "string")
            .map(normalizeSchemaString)
            .filter(Boolean);

          if (units.length > 0) {
            normalizedUnitsByCategory[category] = units;
          }
        }

        unitMap.set(inputId, normalizedUnitsByCategory);
      }
    }
  }

  return {
    tagMap,
    categoryMap,
    unitMap,
  };
}

function buildSchemaInputMapsFromMetadata(customOptionInputs) {
  const tagMap = new Map();
  const categoryMap = new Map();
  const unitMap = new Map();

  for (const input of safeArray(customOptionInputs)) {
    const inputId = String(input?.inputId || "");
    if (!inputId) continue;

    if (input?.type === "tagList") {
      const customTags = safeArray(input?.customTags)
        .filter((tag) => typeof tag === "string")
        .map(normalizeSchemaString)
        .filter(Boolean);

      tagMap.set(inputId, customTags);
    }

    if (input?.type === "priceRangeArray") {
      const categories = safeArray(input?.customCategoryOptions)
        .filter((category) => typeof category === "string")
        .map(normalizeSchemaString)
        .filter(Boolean);

      categoryMap.set(inputId, categories);

      const rawUnitsByCategory = isPlainObject(
        input?.customUnitOptionsByCategory,
      )
        ? input.customUnitOptionsByCategory
        : {};

      const normalizedUnitsByCategory = {};

      for (const [rawCategory, rawUnits] of Object.entries(
        rawUnitsByCategory,
      )) {
        const category = normalizeSchemaString(rawCategory);
        if (!category) continue;

        const units = safeArray(rawUnits)
          .filter((unit) => typeof unit === "string")
          .map(normalizeSchemaString)
          .filter(Boolean);

        if (units.length > 0) {
          normalizedUnitsByCategory[category] = units;
        }
      }

      unitMap.set(inputId, normalizedUnitsByCategory);
    }
  }

  return {
    tagMap,
    categoryMap,
    unitMap,
  };
}

function hasEnabledCustomOptionDiffs(projectSections) {
  if (!PRESENCE_CUSTOM_SCHEMA_DIFFS_ENABLED) return false;

  for (const section of safeArray(projectSections)) {
    for (const input of safeArray(section?.inputs)) {
      if (input?.type === "tagList" && input?.allowCustomTags !== false) {
        return true;
      }

      if (
        input?.type === "priceRangeArray" &&
        input?.allowCustomCategoriesAndUnits !== false
      ) {
        return true;
      }
    }
  }

  return false;
}

function buildDatabaseCustomOptionInputMap(projectSections) {
  const map = new Map();

  for (const section of safeArray(projectSections)) {
    for (const input of safeArray(section?.inputs)) {
      const inputId = String(input?.id || "");
      if (!inputId) continue;

      if (input?.type === "tagList") {
        map.set(inputId, {
          type: "tagList",
          allowCustomTags: input?.allowCustomTags !== false,
        });
      }

      if (input?.type === "priceRangeArray") {
        map.set(inputId, {
          type: "priceRangeArray",
          allowCustomCategoriesAndUnits:
            input?.allowCustomCategoriesAndUnits !== false,
        });
      }
    }
  }

  return map;
}

function diffStringArrays(prevValues = [], nextValues = []) {
  const prevSet = new Set(
    safeArray(prevValues)
      .filter((value) => typeof value === "string")
      .map((value) => value.toLowerCase()),
  );

  const nextSet = new Set(
    safeArray(nextValues)
      .filter((value) => typeof value === "string")
      .map((value) => value.toLowerCase()),
  );

  const added = safeArray(nextValues).filter(
    (value) => typeof value === "string" && !prevSet.has(value.toLowerCase()),
  );

  const removed = safeArray(prevValues).filter(
    (value) => typeof value === "string" && !nextSet.has(value.toLowerCase()),
  );

  return { added, removed };
}

function diffUnitsByCategory(
  prevUnitsByCategory = {},
  nextUnitsByCategory = {},
) {
  const allCategories = new Set([
    ...Object.keys(
      isPlainObject(prevUnitsByCategory) ? prevUnitsByCategory : {},
    ),
    ...Object.keys(
      isPlainObject(nextUnitsByCategory) ? nextUnitsByCategory : {},
    ),
  ]);

  const addedUnitsByCategory = {};
  const removedUnitsByCategory = {};

  for (const category of allCategories) {
    const prevUnits = safeArray(prevUnitsByCategory?.[category]);
    const nextUnits = safeArray(nextUnitsByCategory?.[category]);

    const { added, removed } = diffStringArrays(prevUnits, nextUnits);

    if (added.length > 0) {
      addedUnitsByCategory[category] = added;
    }

    if (removed.length > 0) {
      removedUnitsByCategory[category] = removed;
    }
  }

  return {
    addedUnitsByCategory,
    removedUnitsByCategory,
  };
}

function emptySchemaDiffs() {
  return {
    addedCustomTags: [],
    removedCustomTags: [],
    addedCustomCategories: [],
    removedCustomCategories: [],
    addedCustomUnits: [],
    removedCustomUnits: [],
  };
}

function hasSchemaDiffs(schemaDiffs) {
  return (
    schemaDiffs.addedCustomTags.length > 0 ||
    schemaDiffs.removedCustomTags.length > 0 ||
    schemaDiffs.addedCustomCategories.length > 0 ||
    schemaDiffs.removedCustomCategories.length > 0 ||
    schemaDiffs.addedCustomUnits.length > 0 ||
    schemaDiffs.removedCustomUnits.length > 0
  );
}

function compareSchemaMetadata(currentCustomOptionInputs, projectSections) {
  const currentMaps = buildSchemaInputMapsFromMetadata(
    currentCustomOptionInputs,
  );
  const projectMaps = buildSchemaInputMaps(projectSections);
  const databaseInputMap = buildDatabaseCustomOptionInputMap(projectSections);

  const schemaDiffs = emptySchemaDiffs();

  for (const [inputId, databaseInput] of databaseInputMap.entries()) {
    if (databaseInput.type === "tagList") {
      if (!databaseInput.allowCustomTags) continue;

      const { added, removed } = diffStringArrays(
        currentMaps.tagMap.get(inputId) || [],
        projectMaps.tagMap.get(inputId) || [],
      );

      if (added.length > 0) {
        schemaDiffs.addedCustomTags.push({ inputId, tags: added });
      }

      if (removed.length > 0) {
        schemaDiffs.removedCustomTags.push({ inputId, tags: removed });
      }

      continue;
    }

    if (databaseInput.type === "priceRangeArray") {
      if (!databaseInput.allowCustomCategoriesAndUnits) continue;

      const { added, removed } = diffStringArrays(
        currentMaps.categoryMap.get(inputId) || [],
        projectMaps.categoryMap.get(inputId) || [],
      );

      if (added.length > 0) {
        schemaDiffs.addedCustomCategories.push({
          inputId,
          categories: added,
        });
      }

      if (removed.length > 0) {
        schemaDiffs.removedCustomCategories.push({
          inputId,
          categories: removed,
        });
      }

      const { addedUnitsByCategory, removedUnitsByCategory } =
        diffUnitsByCategory(
          currentMaps.unitMap.get(inputId) || {},
          projectMaps.unitMap.get(inputId) || {},
        );

      if (Object.keys(addedUnitsByCategory).length > 0) {
        schemaDiffs.addedCustomUnits.push({
          inputId,
          unitsByCategory: addedUnitsByCategory,
        });
      }

      if (Object.keys(removedUnitsByCategory).length > 0) {
        schemaDiffs.removedCustomUnits.push({
          inputId,
          unitsByCategory: removedUnitsByCategory,
        });
      }
    }
  }

  return schemaDiffs;
}

/* ─────────────────────────────
   POST - Get All Presence
───────────────────────────── */
router.post("/get", mediumJson, async (req, res) => {
  const payloadValidation = validatePresenceGetPayload(req.body);

  if (!payloadValidation.isValid) {
    return res.status(400).json({
      error: payloadValidation.error,
    });
  }

  const { projectId, schemaMetadata } = req.body;

  try {
    const db = getDB();
    const authUserId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);

    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const access = hasProjectAccess(project, authUserId, "viewer");

    if (!access.hasAccess) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const incomingConfigUpdatedAt = new Date(schemaMetadata.configUpdatedAt);
    const databaseConfigUpdatedAt = new Date(project.configUpdatedAt);

    if (
      !Number.isFinite(incomingConfigUpdatedAt.getTime()) ||
      !Number.isFinite(databaseConfigUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error:
          "Invalid schema config timestamp. Reload before fetching presence data.",
      });
    }

    if (
      incomingConfigUpdatedAt.getTime() !== databaseConfigUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This project's configuration has changed since you loaded it. Reload before fetching presence data.",
      });
    }

    const presences = await db
      .collection("presence")
      .find({
        projectId: projectObjectId,
        type: "presence",
      })
      .toArray();

    const shouldCompareSchemaMetadata =
      Array.isArray(schemaMetadata.customOptionInputs) &&
      hasEnabledCustomOptionDiffs(project.sections);

    const schemaDiffs = shouldCompareSchemaMetadata
      ? compareSchemaMetadata(
          schemaMetadata.customOptionInputs,
          project.sections,
        )
      : emptySchemaDiffs();

    if (presences.length === 0) {
      return res.json({
        message: "No presences found",
        data: [],
        schemaUpdatedAt: hasSchemaDiffs(schemaDiffs) ? project.updatedAt : null,
        ...schemaDiffs,
      });
    }

    const safePresences = presences.map((presence) => {
      const safePresence = {
        ...presence,
        userRole: getPresenceUserRole(presence, authUserId),
      };

      delete safePresence.projectOwnerId;
      delete safePresence.createdByUserId;

      return safePresence;
    });

    return res.json({
      message: "Presences retrieved",
      data: safePresences,
      schemaUpdatedAt: hasSchemaDiffs(schemaDiffs) ? project.updatedAt : null,
      ...schemaDiffs,
    });
  } catch (err) {
    console.error("Fetch failed:", err);
    return res.status(500).json({ error: "Failed to fetch presences" });
  }
});

/* ─────────────────────────────
   POST - Get One Presence
───────────────────────────── */
router.post("/get/:_id", smallJson, async (req, res) => {
    if (!hasExactKeys(req.body, ["projectId"])) {
    return res.status(400).json({
      error: "Invalid get presence payload.",
    });
  }

  const { projectId } = req.body;
  const { _id } = req.params;

  if (!projectId || !_id) {
    return res.status(400).json({ error: "Missing projectId or _id." });
  }

  try {
    const db = getDB();
    const authUserId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);
    const presenceObjectId = new ObjectId(_id);

    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const access = hasProjectAccess(project, authUserId, "viewer");

    if (!access.hasAccess) {
      return res.status(404).json({
        error: "Presence not found or unauthorized.",
      });
    }

    const presence = await db.collection("presence").findOne({
      projectId: projectObjectId,
      _id: presenceObjectId,
      type: "presence",
    });

    if (!presence) {
      return res.status(404).json({
        error: "Presence not found or unauthorized.",
      });
    }

    const safePresence = {
      ...presence,
      userRole: getPresenceUserRole(presence, authUserId),
    };

    delete safePresence.projectOwnerId;
    delete safePresence.createdByUserId;

    return res.json({
      message: "Presence retrieved",
      data: safePresence,
    });
  } catch (err) {
    console.error("Fetch one failed:", err);
    return res.status(500).json({ error: "Failed to fetch presence" });
  }
});

/* ─────────────────────────────
   POST - Add Presence
───────────────────────────── */
router.post("/add", mediumJson, async (req, res) => {
  if (
    !hasExactKeys(req.body, [
      "projectId",
      "schemaUpdatedAt",
      "presence",
    ])
  ) {
    return res.status(400).json({
      error: "Invalid add presence payload.",
    });
  }

  const { projectId, schemaUpdatedAt, presence } = req.body;

  if (!projectId || !schemaUpdatedAt || !presence) {
    return res.status(400).json({
      error: "Missing projectId, schemaUpdatedAt, or presence.",
    });
  }

  try {
    const db = getDB();
    const authUserId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);

    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const access = hasProjectAccess(
      project,
      authUserId,
      "editor",
    );

    if (!access.hasAccess) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const user = await db.collection("users").findOne(
      { _id: authUserId },
      {
        projection: {
          userName: 1,
          userColorTheme: 1,
        },
      },
    );

    if (!user?.userName) {
      return res.status(401).json({
        error: "Invalid user session.",
      });
    }

    const incomingSchemaUpdatedAt = new Date(schemaUpdatedAt);
    const databaseSchemaUpdatedAt = new Date(project.updatedAt);

    if (
      !Number.isFinite(incomingSchemaUpdatedAt.getTime()) ||
      !Number.isFinite(databaseSchemaUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error:
          "Invalid schema timestamp. Reload before starting presence.",
      });
    }

    if (
      incomingSchemaUpdatedAt.getTime() !==
      databaseSchemaUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This project's schema has changed since you loaded it. Reload before starting presence.",
      });
    }

    const existingPresenceCount = await db
      .collection("presence")
      .countDocuments({
        projectId: projectObjectId,
        type: "presence",
      });

    if (existingPresenceCount >= PROJECT_LIMITS.maxDataItems) {
      return res.status(400).json({
        error: `This project has reached the maximum of ${PROJECT_LIMITS.maxDataItems} presences.`,
      });
    }

    const validation = validateDataItemPayload({
      schema: project,
      dataItem: presence,
      mode: "add",
    });

    if (!validation.isValid) {
      return res.status(400).json({
        error:
          validation.error || "Invalid presence payload.",
      });
    }

    const safePresence = buildDataItemFieldsFromForm(
      project,
      presence,
      {
        includeExtensions: true,
      },
    );

    if (!safePresence) {
      return res.status(400).json({
        error: "Invalid presence payload.",
      });
    }

    const now = new Date();
    const layer = Number(presence.layer);

    const insertDoc = {
      projectId: projectObjectId,
      projectOwnerId: project.projectOwnerId,
      createdByUserId: authUserId,
      type: "presence",
      layer,
      userName: user.userName,
      userColorTheme: user.userColorTheme || "green",
      geometry: safePresence.geometry,
      time: safePresence.time,
      sections: safePresence.sections,
      extensions: safePresence.extensions,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db
      .collection("presence")
      .insertOne(insertDoc);

    return res.status(201).json({
      message: "Presence added",
      data: {
        _id: result.insertedId,
        userName: insertDoc.userName,
        userColorTheme: insertDoc.userColorTheme,
        createdAt: insertDoc.createdAt,
        updatedAt: insertDoc.updatedAt,
      },
    });
  } catch (err) {
    console.error("Add failed:", err);

    return res.status(500).json({
      error: "Failed to add presence",
    });
  }
});

/* ─────────────────────────────
   PUT - Update Presence
───────────────────────────── */
router.put("/update/:_id", mediumJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["projectId", "schemaUpdatedAt", "presence"])) {
    return res.status(400).json({
      error: "Invalid update presence payload.",
    });
  }


  const { projectId, schemaUpdatedAt, presence } = req.body;
  const { _id } = req.params;

  if (!projectId || !schemaUpdatedAt || !presence || !_id) {
    return res.status(400).json({
      error: "Missing projectId, schemaUpdatedAt, presence, or _id.",
    });
  }

  try {
    const db = getDB();
    const authUserId = new ObjectId(req.userId);
    const authUserIdString = String(authUserId);
    const projectObjectId = new ObjectId(projectId);
    const presenceObjectId = new ObjectId(_id);

    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const access = hasProjectAccess(project, authUserId, "editor");

    if (!access.hasAccess) {
      return res.status(404).json({
        error: "Presence not found or unauthorized.",
      });
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

    const existingPresence = await db.collection("presence").findOne({
      projectId: projectObjectId,
      _id: presenceObjectId,
      type: "presence",
    });

    if (!existingPresence) {
      return res.status(404).json({
        error: "Presence not found or unauthorized.",
      });
    }

    if (String(existingPresence.createdByUserId) !== authUserIdString) {
      return res.status(403).json({
        error: "You can only update your own presence data.",
      });
    }

    const validation = validateDataItemPayload({
      schema: project,
      dataItem: presence,
      mode: "update",
    });

    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.error || "Invalid presence payload.",
      });
    }

    if (String(presence._id) !== String(_id)) {
      return res.status(400).json({
        error: "Invalid presence payload.",
      });
    }

    const incomingPresenceUpdatedAt = new Date(presence.updatedAt);
    const databasePresenceUpdatedAt = new Date(existingPresence.updatedAt);

    if (
      !Number.isFinite(incomingPresenceUpdatedAt.getTime()) ||
      !Number.isFinite(databasePresenceUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid presence timestamp. Reload before updating.",
      });
    }

    if (
      incomingPresenceUpdatedAt.getTime() !==
      databasePresenceUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This presence has changed since you loaded it. Reload before updating.",
      });
    }

    const safePresenceFields = buildDataItemFieldsFromForm(project, presence, {
      includeExtensions: false,
    });

    if (!safePresenceFields) {
      return res.status(400).json({ error: "Invalid presence payload." });
    }

    safePresenceFields.sections = normalizeTagListSections(
      project.sections,
      safePresenceFields.sections,
    );

    safePresenceFields.sections = normalizePriceRangeSections(
      project.sections,
      safePresenceFields.sections,
    );

    const now = new Date();

    const prospectiveUpdatedPresence = {
      ...existingPresence,
      ...safePresenceFields,
      updatedAt: now,
    };

    const otherPresences = await db
      .collection("presence")
      .find({
        projectId: projectObjectId,
        type: "presence",
        _id: { $ne: presenceObjectId },
      })
      .toArray();

    const prospectivePresences = [
      ...otherPresences,
      prospectiveUpdatedPresence,
    ];

    const { nextSections: tagMergedSections, addedCustomTags } =
      mergeTagsIntoProjectSections(
        project.sections,
        prospectiveUpdatedPresence.sections,
      );

    const { nextSections: tagCleanedSections, removedCustomTags } =
      removeUnusedCustomTagsAfterDataItemUpdate(
        tagMergedSections,
        existingPresence.sections,
        prospectiveUpdatedPresence.sections,
        otherPresences,
      );

    const {
      nextSections,
      addedCustomCategories,
      removedCustomCategories,
      addedCustomUnits,
      removedCustomUnits,
    } = recomputeProjectPriceSections(tagCleanedSections, prospectivePresences);

    const updateResult = await db.collection("presence").findOneAndUpdate(
      {
        projectId: projectObjectId,
        _id: presenceObjectId,
        type: "presence",
      },
      {
        $set: {
          ...safePresenceFields,
          updatedAt: now,
        },
      },
      {
        returnDocument: "after",
      },
    );

    const updatedPresence = updateResult?.value;

    if (!updatedPresence) {
      return res.status(404).json({
        error: "Presence not found or unauthorized.",
      });
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

    const safeUpdatedPresence = { ...updatedPresence };

    delete safeUpdatedPresence.projectOwnerId;
    delete safeUpdatedPresence.createdByUserId;

    return res.json({
      message: "Presence updated",
      data: safeUpdatedPresence,
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

    return res.status(500).json({ error: "Failed to update presence" });
  }
});

/* ─────────────────────────────
   PUT - Ping Presence
───────────────────────────── */
router.put("/ping/:_id", smallJson, async (req, res) => {
    if (!hasExactKeys(req.body, ["projectId", "coordinates"])) {
    return res.status(400).json({
      error: "Invalid ping presence payload.",
    });
  }

  const { projectId, coordinates } = req.body;
  const { _id } = req.params;

  if (
    !projectId ||
    !_id ||
    !Array.isArray(coordinates) ||
    coordinates.length !== 2
  ) {
    return res.status(400).json({
      error: "Missing projectId, _id, or coordinates.",
    });
  }

  try {
    const db = getDB();
    const authUserId = new ObjectId(req.userId);
    const authUserIdString = String(authUserId);
    const projectObjectId = new ObjectId(projectId);
    const presenceObjectId = new ObjectId(_id);

    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const access = hasProjectAccess(project, authUserId, "editor");

    if (!access.hasAccess) {
      return res.status(404).json({
        error: "Presence not found or unauthorized.",
      });
    }

    const safeGeometry = {
      type: "Point",
      coordinates: [Number(coordinates[0]), Number(coordinates[1])],
    };

    if (!validateGeometryPayload(project, safeGeometry)) {
      return res.status(400).json({
        error: "Invalid coordinates.",
      });
    }

    const existingPresence = await db.collection("presence").findOne({
      projectId: projectObjectId,
      _id: presenceObjectId,
      type: "presence",
    });

    if (!existingPresence) {
      return res.status(404).json({
        error: "Presence not found or unauthorized.",
      });
    }

    if (String(existingPresence.createdByUserId) !== authUserIdString) {
      return res.status(403).json({
        error: "You can only ping your own presence data.",
      });
    }

    const timezoneTarget = {
      geometry: safeGeometry,
      time: structuredClone(existingPresence.time || {}),
    };

    reapplyTimezoneFromLatLng(timezoneTarget);

    const nextTime = timezoneTarget.time;
    const now = new Date();
    const nowIso = now.toISOString();

    if (nextTime?.type === "Event") {
      nextTime.dates = [
        {
          start: nowIso,
          end: nowIso,
        },
      ];
    }

    const updateResult = await db.collection("presence").findOneAndUpdate(
      {
        projectId: projectObjectId,
        _id: presenceObjectId,
        type: "presence",
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

    const updatedPresence = updateResult?.value;

    if (!updatedPresence) {
      return res.status(404).json({
        error: "Presence not found or unauthorized.",
      });
    }

    return res.json({
      message: "Presence pinged",
      data: {
        _id: updatedPresence._id,
        time: updatedPresence.time,
        updatedAt: updatedPresence.updatedAt,
      },
    });
  } catch (err) {
    console.error("Ping failed:", err);
    return res.status(500).json({
      error: "Failed to ping presence",
    });
  }
});

/* ─────────────────────────────
   DELETE - Remove Presence (Cascade Cleanup)
───────────────────────────── */
router.delete("/remove/:_id", smallJson, async (req, res) => {
   if (!hasExactKeys(req.body, ["projectId"])) {
    return res.status(400).json({
      error: "Invalid remove presence payload.",
    });
  }

  const { projectId } = req.body;
  const { _id } = req.params;

  if (!projectId || !_id) {
    return res.status(400).json({ error: "Missing projectId or _id." });
  }

  try {
    const db = getDB();
    const authUserId = new ObjectId(req.userId);
    const authUserIdString = String(authUserId);
    const projectObjectId = new ObjectId(projectId);
    const presenceObjectId = new ObjectId(_id);

    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const access = hasProjectAccess(project, authUserId, "editor");

    if (!access.hasAccess) {
      return res.status(404).json({
        error: "Presence not found or unauthorized.",
      });
    }

    const existingPresence = await db.collection("presence").findOne({
      projectId: projectObjectId,
      _id: presenceObjectId,
      type: "presence",
    });

    if (!existingPresence) {
      return res.status(404).json({
        error: "Presence not found or unauthorized.",
      });
    }

    if (String(existingPresence.createdByUserId) !== authUserIdString) {
      return res.status(403).json({
        error: "You can only remove your own presence data.",
      });
    }

    const result = await removePresenceCascade(db, project, existingPresence);

    const shouldUpdateProject =
      result.removedCustomTags.length > 0 ||
      result.addedCustomCategories.length > 0 ||
      result.removedCustomCategories.length > 0 ||
      result.addedCustomUnits.length > 0 ||
      result.removedCustomUnits.length > 0;

    let schemaUpdatedAtResult = project.updatedAt;

    if (shouldUpdateProject) {
      schemaUpdatedAtResult = new Date();

      await db.collection("projects").updateOne(
        { _id: projectObjectId },
        {
          $set: {
            sections: result.nextSections,
            updatedAt: schemaUpdatedAtResult,
          },
        },
      );
    }

    return res.json({
      message: result.summary.join("\n"),
      data: { _id },
      schemaUpdatedAt: schemaUpdatedAtResult,
      removedCustomTags: result.removedCustomTags,
      addedCustomCategories: result.addedCustomCategories,
      removedCustomCategories: result.removedCustomCategories,
      addedCustomUnits: result.addedCustomUnits,
      removedCustomUnits: result.removedCustomUnits,
    });
  } catch (err) {
    console.error("Delete failed:", err);

    if (err?.status === 400) {
      return res.status(400).json({
        error: err.message || "Invalid tag list or price range data.",
      });
    }

    return res.status(500).json({
      error: "Failed to remove presence",
    });
  }
});

/* ─────────────────────────────
   PUT - Toggle Presence Extensions
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
      error: "Invalid toggle presence extensions payload.",
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
    const authUserId = new ObjectId(req.userId);
    const authUserIdString = String(authUserId);
    const projectObjectId = new ObjectId(projectId);
    const presenceObjectId = new ObjectId(_id);

    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const access = hasProjectAccess(project, authUserId, "editor");

    if (!access.hasAccess) {
      return res.status(404).json({
        error: "Presence not found or unauthorized.",
      });
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

    const existingPresence = await db.collection("presence").findOne({
      projectId: projectObjectId,
      _id: presenceObjectId,
      type: "presence",
    });

    if (!existingPresence) {
      return res.status(404).json({
        error: "Presence not found or unauthorized.",
      });
    }

    if (String(existingPresence.createdByUserId) !== authUserIdString) {
      return res.status(403).json({
        error: "You can only update your own presence data.",
      });
    }

    const incomingUpdatedAt = new Date(updatedAt);
    const databaseUpdatedAt = new Date(existingPresence.updatedAt);

    if (
      !Number.isFinite(incomingUpdatedAt.getTime()) ||
      !Number.isFinite(databaseUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid presence timestamp. Reload before updating extensions.",
      });
    }

    if (incomingUpdatedAt.getTime() !== databaseUpdatedAt.getTime()) {
      return res.status(409).json({
        error:
          "This presence has changed since you loaded it. Reload before updating extensions.",
      });
    }

    if (!validateExtensionsPayload(project, extensions)) {
      return res.status(400).json({
        error: "Invalid extensions.",
      });
    }

    const safeExtensions = structuredClone(extensions);

    const wasGalleryEnabled = existingPresence.extensions?.Gallery === true;
    const nextGalleryEnabled = safeExtensions.Gallery === true;

    const wasGuestbookEnabled = existingPresence.extensions?.Guestbook === true;
    const nextGuestbookEnabled = safeExtensions.Guestbook === true;

    const summary = [];

    if (wasGalleryEnabled && !nextGalleryEnabled) {
      const images = await db
        .collection("presence")
        .find({
          projectId: projectObjectId,
          dataItemId: presenceObjectId,
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

        const imageDeleteResult = await db.collection("presence").deleteMany({
          projectId: projectObjectId,
          dataItemId: presenceObjectId,
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
      const guestbookDeleteResult = await db.collection("presence").deleteOne({
        projectId: projectObjectId,
        dataItemId: presenceObjectId,
        type: "guestbook",
      });

      if (guestbookDeleteResult.deletedCount === 1) {
        summary.push("Guestbook removed");
      }
    }

    const now = new Date();

    const updateResult = await db.collection("presence").findOneAndUpdate(
      {
        projectId: projectObjectId,
        _id: presenceObjectId,
        type: "presence",
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

    const updatedPresence = updateResult?.value;

    if (!updatedPresence) {
      return res.status(404).json({
        error: "Presence not found or unauthorized.",
      });
    }

    summary.push("Presence extensions updated");

    return res.json({
      message: summary.join("\n"),
      data: {
        _id: updatedPresence._id,
        updatedAt: updatedPresence.updatedAt,
      },
    });
  } catch (err) {
    console.error("Toggle extensions failed:", err);
    return res.status(500).json({
      error: "Failed to update presence extensions",
    });
  }
});

export default router;
