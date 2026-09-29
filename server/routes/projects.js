import express from "express";
import { tinyJson, smallJson, largeJson } from "../middleware/bodyLimits.js";
import { ObjectId } from "mongodb";
import { getDB } from "../db.js";
import { storage } from "../media/mediaService.js";
import { hasProjectAccess } from "../utils/projectPermissions.js";
import {
  getBlockedRelationshipIds,
  isBlockedRelationship,
} from "../utils/blockedUsers.js";
import { sanitizeUserRefs } from "../utils/userRefs.js";
import { getExportableProjectDocs } from "../utils/getExportableProjectDocs.js";
import { buildProjectGeoJSON } from "../../shared/exports/geoJSONExport.js";
import {
  hasExactKeys,
  hasNoKeys,
  validateProjectCreatePayload,
  validateProjectRolePayload,
  validateProjectSchema,
  validateProjectSettingsPayload,
  validateProjectVisibilityPayload,
} from "../../shared/validation/projectValidation.js";
import {
  GEOMETRY_LIMITS,
  PROJECT_LIMITS,
  SUBSCRIPTION_LIMITS,
} from "../../shared/validation/validationConstants.js";
import { ENGINE_KEYS } from "../../shared/validation/schemaConstants.js";
import { normalizeTag } from "../../shared/validation/formValueHelpers.js";
import { USER_COLOR_THEME_OPTIONS } from "../../shared/validation/userConstants.js";
import { DEFAULT_SCHEMAS_BY_ENGINE } from "../engines/defaultSchemas.js";
import { deleteProjectSpatialDocs } from "../utils/deleteProjectSpatialDocs.js";
import {
  migrateProjectDataForSchemaUpdate,
  generateProjectMigrationPlan,
  enforceBulletinLimits,
  enforceProjectChatLimits,
  enforceGalleryMaxImages,
} from "../utils/projectMigrationHelpers.js";

const router = express.Router();

async function getProjectCreationLimitForUser(db, userId) {
  const user = await db.collection("users").findOne(
    { _id: userId },
    {
      projection: {
        subscriptionTier: 1,
        userName: 1,
        userColorTheme: 1,
      },
    },
  );

  const userName = String(user?.userName || "").trim();
  const userColorTheme = String(user?.userColorTheme || "green").trim();

  const subscriptionTier = String(user?.subscriptionTier || "free")
    .trim()
    .toLowerCase();

  const maxProjects =
    SUBSCRIPTION_LIMITS.maxProjectsByTier[subscriptionTier] ??
    SUBSCRIPTION_LIMITS.maxProjectsByTier.free;

  return {
    userName,
    userColorTheme,
    subscriptionTier,
    maxProjects,
  };
}

async function enforceProjectCreationLimit(db, userId) {
  const { userName, userColorTheme, subscriptionTier, maxProjects } =
    await getProjectCreationLimitForUser(db, userId);

  const currentProjectCount = await db
    .collection("projects")
    .countDocuments({ projectOwnerId: userId });

  if (currentProjectCount >= maxProjects) {
    return {
      allowed: false,
      userName,
      userColorTheme,
      subscriptionTier,
      maxProjects,
      currentProjectCount,
    };
  }

  return {
    allowed: true,
    userName,
    userColorTheme,
    subscriptionTier,
    maxProjects,
    currentProjectCount,
  };
}

function buildSchemaValidationError(errors = []) {
  const filtered = Array.isArray(errors)
    ? errors.filter((error) => typeof error === "string" && error.trim() !== "")
    : [];

  return filtered.length > 0
    ? filtered.join("\n")
    : "Project schema validation failed.";
}

/* ─────────────────────────────
   Helper: Parse a comma-separated filter query value against an
   allow-list. Returns null if the value is absent, or the array of
   parsed values if present and every value is allowed. Returns
   undefined if present but contains a disallowed value.
───────────────────────────── */
function parseListFilter(rawValue, allowedValues) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return null;
  }

  const values = String(rawValue)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  if (values.length === 0) return null;

  const allValid = values.every((v) => allowedValues.includes(v));
  if (!allValid) return undefined;

  return values;
}

/* ─────────────────────────────
   GET - All Projects (Owned by user)
───────────────────────────── */
router.get("/get", async (req, res) => {
  try {
    const db = getDB();
    const projectOwnerId = new ObjectId(req.userId);

    const projects = await db
      .collection("projects")
      .find(
        { projectOwnerId },
        {
          projection: {
            _id: 1,
            projectName: 1,
            projectDescription: 1,
            projectTags: 1,
            engineKey: 1,
            visibility: 1,
            owner: 1,
            ownerColorTheme: 1,
            adminRole: 1,
            editorRole: 1,
            viewerRole: 1,
            createdAt: 1,
            updatedAt: 1,
            configUpdatedAt: 1,
          },
        },
      )
      .sort({ updatedAt: -1 })
      .toArray();

    if (projects.length === 0) {
      return res.json({
        message: "No projects found",
        data: [],
      });
    }

    const safeProjects = projects.map((project) => ({
      ...project,
      userRole: "owner",
      adminRole: sanitizeUserRefs(project.adminRole),
      editorRole: sanitizeUserRefs(project.editorRole),
      viewerRole: sanitizeUserRefs(project.viewerRole),
    }));

    return res.json({
      message: "Projects retrieved",
      data: safeProjects,
    });
  } catch (err) {
    console.error("Fetch projects failed:", err);
    return res.status(500).json({
      error: "Failed to fetch projects.",
    });
  }
});

/* ─────────────────────────────
   GET - Public/Open Projects
───────────────────────────── */
router.get("/public", async (req, res) => {
  const PUBLIC_VISIBILITY_OPTIONS = ["public", "open"];

  const {
    engineKey,
    visibility,
    geometryTypes,
    geometryMode,
    name,
    tags,
    updatedAtFrom,
    updatedAtTo,
  } = req.query;

  const query = { visibility: { $in: PUBLIC_VISIBILITY_OPTIONS } };

  const engineKeys = parseListFilter(engineKey, ENGINE_KEYS);
  if (engineKeys === undefined) {
    return res.status(400).json({ error: "Invalid engineKey filter." });
  }
  if (engineKeys) {
    query.engineKey = { $in: engineKeys };
  }

  const visibilities = parseListFilter(visibility, PUBLIC_VISIBILITY_OPTIONS);
  if (visibilities === undefined) {
    return res.status(400).json({ error: "Invalid visibility filter." });
  }
  if (visibilities) {
    query.visibility = { $in: visibilities };
  }

  const geometryTypeList = parseListFilter(
    geometryTypes,
    GEOMETRY_LIMITS.typeOptions,
  );
  if (geometryTypeList === undefined) {
    return res.status(400).json({ error: "Invalid geometryTypes filter." });
  }
  if (geometryTypeList) {
    query["geometry.types"] =
      geometryMode === "all"
        ? { $all: geometryTypeList }
        : { $in: geometryTypeList };
  }

  if (name !== undefined && name !== null && String(name).trim() !== "") {
    const trimmedName = String(name).trim().slice(0, 200);
    const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.projectName = { $regex: escapedName, $options: "i" };
  }

  if (tags !== undefined && tags !== null && String(tags).trim() !== "") {
    const tagList = String(tags)
      .split(",")
      .map((tag) => normalizeTag(tag))
      .filter(Boolean)
      .slice(0, PROJECT_LIMITS.maxProjectTags);

    if (tagList.length > 0) {
      query.projectTags = { $in: tagList };
    }
  }

  if (updatedAtFrom || updatedAtTo) {
    const updatedAtRange = {};

    if (updatedAtFrom) {
      const fromDate = new Date(updatedAtFrom);
      if (!Number.isFinite(fromDate.getTime())) {
        return res.status(400).json({ error: "Invalid updatedAtFrom filter." });
      }
      updatedAtRange.$gte = fromDate;
    }

    if (updatedAtTo) {
      const toDate = new Date(updatedAtTo);
      if (!Number.isFinite(toDate.getTime())) {
        return res.status(400).json({ error: "Invalid updatedAtTo filter." });
      }
      toDate.setHours(23, 59, 59, 999);
      updatedAtRange.$lte = toDate;
    }

    query.updatedAt = updatedAtRange;
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);

    const excludedOwnerIds = await getBlockedRelationshipIds(db, userId);
    if (excludedOwnerIds.length > 0) {
      query.projectOwnerId = { $nin: excludedOwnerIds };
    }

    const projects = await db
      .collection("projects")
      .find(query, {
        projection: {
          _id: 1,
          projectName: 1,
          projectDescription: 1,
          projectTags: 1,
          engineKey: 1,
          visibility: 1,
          owner: 1,
          ownerColorTheme: 1,
          projectOwnerId: 1,
          adminRole: 1,
          editorRole: 1,
          viewerRole: 1,
          updatedAt: 1,
          configUpdatedAt: 1,
        },
      })
      .sort({ updatedAt: -1 })
      .toArray();

    if (projects.length === 0) {
      return res.json({
        message: "No public projects found",
        data: [],
      });
    }

    const safeProjects = projects.map((project) => {
      const access = hasProjectAccess(project, userId, "viewer");
      const canViewSensitiveRoles =
        access.resolvedRole === "owner" || access.resolvedRole === "admin";

      const safeProject = {
        ...project,
        userRole: access.resolvedRole || "viewer",
      };

      delete safeProject.projectOwnerId;

      if (canViewSensitiveRoles) {
        safeProject.adminRole = sanitizeUserRefs(safeProject.adminRole);
        safeProject.editorRole = sanitizeUserRefs(safeProject.editorRole);
        safeProject.viewerRole = sanitizeUserRefs(safeProject.viewerRole);
      } else {
        delete safeProject.adminRole;
        delete safeProject.editorRole;
        delete safeProject.viewerRole;
      }

      return safeProject;
    });

    return res.json({
      message: "Public projects retrieved",
      data: safeProjects,
    });
  } catch (err) {
    console.error("Fetch public projects failed:", err);
    return res.status(500).json({
      error: "Failed to fetch public projects.",
    });
  }
});

/* ─────────────────────────────
   GET - Shared Projects
───────────────────────────── */
router.get("/shared", async (req, res) => {
  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);

    const excludedOwnerIds = await getBlockedRelationshipIds(db, userId);

    const sharedProjects = await db
      .collection("projects")
      .find(
        {
          projectOwnerId: { $ne: userId, $nin: excludedOwnerIds },
          $or: [
            { "adminRole._id": userId },
            { "editorRole._id": userId },
            { "viewerRole._id": userId },
          ],
        },
        {
          projection: {
            _id: 1,
            projectName: 1,
            projectDescription: 1,
            projectTags: 1,
            engineKey: 1,
            visibility: 1,
            owner: 1,
            ownerColorTheme: 1,
            adminRole: 1,
            editorRole: 1,
            viewerRole: 1,
            updatedAt: 1,
            configUpdatedAt: 1,
          },
        },
      )
      .sort({ updatedAt: -1 })
      .toArray();

    if (sharedProjects.length === 0) {
      return res.json({
        message: "No shared projects found",
        data: [],
      });
    }

    const userIdString = String(userId);

    const safeSharedProjects = sharedProjects.map((project) => {
      const isAdmin = (project.adminRole || []).some(
        (roleUser) => String(roleUser?._id) === userIdString,
      );
      const isEditor = (project.editorRole || []).some(
        (roleUser) => String(roleUser?._id) === userIdString,
      );

      const userRole = isAdmin ? "admin" : isEditor ? "editor" : "viewer";

      return {
        ...project,
        userRole,
        adminRole: isAdmin ? sanitizeUserRefs(project.adminRole) : undefined,
        editorRole: isAdmin ? sanitizeUserRefs(project.editorRole) : undefined,
        viewerRole: isAdmin ? sanitizeUserRefs(project.viewerRole) : undefined,
      };
    });

    return res.json({
      message: "Shared projects retrieved",
      data: safeSharedProjects,
    });
  } catch (err) {
    console.error("Fetch shared projects failed:", err);
    return res.status(500).json({
      error: "Failed to fetch shared projects.",
    });
  }
});

/* ─────────────────────────────
   GET - One Project
   Access: owner OR public/open OR viewer/editor/admin
───────────────────────────── */
router.get("/get/:_id", async (req, res) => {
  const { _id } = req.params;

  if (!_id) {
    return res.status(400).json({ error: "Missing _id." });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectId = new ObjectId(_id);

    const project = await db.collection("projects").findOne({
      _id: projectId,
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    const access = hasProjectAccess(project, userId, "viewer");

    if (!access.hasAccess) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    if (
      !access.isOwner &&
      (await isBlockedRelationship(db, userId, project.projectOwnerId))
    ) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const canViewSensitiveRoles =
      access.resolvedRole === "owner" || access.resolvedRole === "admin";

    const safeProject = {
      ...project,
      userRole: access.resolvedRole || "viewer",
    };

    delete safeProject.projectOwnerId;

    if (canViewSensitiveRoles) {
      safeProject.adminRole = sanitizeUserRefs(safeProject.adminRole);
      safeProject.editorRole = sanitizeUserRefs(safeProject.editorRole);
      safeProject.viewerRole = sanitizeUserRefs(safeProject.viewerRole);
    } else {
      delete safeProject.adminRole;
      delete safeProject.editorRole;
      delete safeProject.viewerRole;
    }

    return res.json({
      message: "Project retrieved",
      data: safeProject,
    });
  } catch (err) {
    console.error("Fetch project failed:", err);
    return res.status(500).json({
      error: "Failed to fetch project.",
    });
  }
});

/* ─────────────────────────────
   POST - Add a new project
   Access: authenticated
───────────────────────────── */
router.post("/add", smallJson, async (req, res) => {
  if (!validateProjectCreatePayload(req.body)) {
    return res.status(400).json({
      error: "Invalid add project payload.",
    });
  }

  const {
    engineKey,
    projectName,
    projectDescription,
    projectTags,
    visibility,
  } = req.body;

  const defaultSchema = DEFAULT_SCHEMAS_BY_ENGINE[engineKey];

  if (!defaultSchema) {
    return res.status(400).json({
      error: "Invalid engine.",
    });
  }

  try {
    const db = getDB();
    const projectOwnerId = new ObjectId(req.userId);

    const quotaCheck = await enforceProjectCreationLimit(db, projectOwnerId);

    if (!quotaCheck.userName) {
      return res.status(401).json({
        error: "Invalid user session.",
      });
    }

    if (!quotaCheck.allowed) {
      return res.status(403).json({
        error: `Project limit reached for ${quotaCheck.subscriptionTier} tier (${quotaCheck.maxProjects} max).`,
      });
    }

    const owner = quotaCheck.userName;

    const ownerColorTheme = USER_COLOR_THEME_OPTIONS.includes(
      quotaCheck.userColorTheme,
    )
      ? quotaCheck.userColorTheme
      : USER_COLOR_THEME_OPTIONS.includes(defaultSchema.ownerColorTheme)
        ? defaultSchema.ownerColorTheme
        : "green";

    const now = new Date();

    const insertDoc = {
      projectOwnerId,
      owner,
      ownerColorTheme,
      visibility,
      viewerRole: [],
      editorRole: [],
      adminRole: [],
      engineKey,
      projectName: projectName.trim(),
      projectDescription,
      projectTags,
      previewText: structuredClone(defaultSchema.previewText || ""),
      geometry: structuredClone(defaultSchema.geometry),
      time: structuredClone(defaultSchema.time),
      sections: structuredClone(defaultSchema.sections || []),
      extensions: structuredClone(defaultSchema.extensions || {}),
      createdAt: now,
      updatedAt: now,
      configUpdatedAt: now,
    };

    const result = await db.collection("projects").insertOne(insertDoc);

    return res.status(201).json({
      message: "Project added",
      data: {
        _id: result.insertedId,
        updatedAt: insertDoc.updatedAt,
        configUpdatedAt: insertDoc.configUpdatedAt,
      },
    });
  } catch (err) {
    console.error("Insert failed:", err);
    return res.status(500).json({
      error: "Failed to add project.",
    });
  }
});

/* ─────────────────────────────
   POST - Clone Project
   Access: authenticated, with access to the source project
───────────────────────────── */
router.post("/clone/:_id", tinyJson, async (req, res) => {
  if (!hasNoKeys(req.body)) {
    return res.status(400).json({
      error: "Invalid clone project payload.",
    });
  }

  const { _id } = req.params;

  if (!_id) {
    return res.status(400).json({
      error: "Missing _id.",
    });
  }

  try {
    const db = getDB();
    const sourceProjectId = new ObjectId(_id);
    const requesterId = new ObjectId(req.userId);

    const sourceProject = await db.collection("projects").findOne({
      _id: sourceProjectId,
    });

    if (!sourceProject) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    /*
     * Access to the project is the whole check. Cloning is export plus
     * import in one step, and exporting is no longer gated at all - so
     * gating the convenient version of something anyone can already do
     * by hand only slowed people down (Brody's own call).
     */
    const access = hasProjectAccess(sourceProject, requesterId, "viewer");

    if (!access.hasAccess) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const quotaCheck = await enforceProjectCreationLimit(db, requesterId);

    if (!quotaCheck.userName) {
      return res.status(401).json({
        error: "Invalid user session.",
      });
    }

    if (!quotaCheck.allowed) {
      return res.status(403).json({
        error: `Project limit reached for ${quotaCheck.subscriptionTier} tier (${quotaCheck.maxProjects} max).`,
      });
    }

    const requesterUserName = quotaCheck.userName;

    const requesterColorTheme = USER_COLOR_THEME_OPTIONS.includes(
      quotaCheck.userColorTheme,
    )
      ? quotaCheck.userColorTheme
      : "green";

    const baseProjectName = String(
      sourceProject.projectName || "Untitled Project",
    ).trim();

    const now = new Date();

    const clonedProject = {
      projectOwnerId: requesterId,
      owner: requesterUserName,
      ownerColorTheme: requesterColorTheme,
      visibility: "private",
      viewerRole: [],
      editorRole: [],
      adminRole: [],
      engineKey: sourceProject.engineKey,
      projectName: `${baseProjectName} Copy`,
      projectDescription: sourceProject.projectDescription || "",
      projectTags: Array.isArray(sourceProject.projectTags)
        ? [...sourceProject.projectTags]
        : [],
      previewText: sourceProject.previewText || "",
      geometry: structuredClone(sourceProject.geometry || {}),
      time: structuredClone(sourceProject.time || {}),
      sections: structuredClone(sourceProject.sections || []),
      extensions: structuredClone(sourceProject.extensions || {}),
      createdAt: now,
      updatedAt: now,
      configUpdatedAt: now,
    };

    const insertResult = await db
      .collection("projects")
      .insertOne(clonedProject);

    const newProjectId = insertResult.insertedId;

    const shouldCloneData = sourceProject.engineKey !== "presence";

    if (!shouldCloneData) {
      return res.status(201).json({
        message: "Project cloned successfully.",
        data: {
          _id: newProjectId,
          updatedAt: clonedProject.updatedAt,
          configUpdatedAt: clonedProject.configUpdatedAt,
        },
      });
    }

    const collectionName = sourceProject.engineKey;
    const engineCollection = db.collection(collectionName);

    const dataItemType =
      collectionName === "places"
        ? "place"
        : collectionName === "events"
          ? "event"
          : collectionName === "neighbourhoods"
            ? "neighbourhood"
            : collectionName === "motion"
              ? "motion"
              : null;

    if (!dataItemType) {
      return res.status(400).json({
        error: "Unsupported project engine.",
      });
    }

    const sourceDocs = await engineCollection
      .find({
        $or: [
          { projectId: sourceProjectId },
          { projectId: String(sourceProjectId) },
        ],
      })
      .toArray();

    if (sourceDocs.length === 0) {
      return res.status(201).json({
        message: "Project cloned, but no source documents were found to copy.",
        data: {
          _id: newProjectId,
        },
      });
    }

    const dataItemDocs = sourceDocs.filter((doc) => doc.type === dataItemType);
    const imageDocs = sourceDocs.filter((doc) => doc.type === "image");
    const extensionDocs = sourceDocs.filter(
      (doc) => doc.type !== dataItemType && doc.type !== "image",
    );

    const docIdMap = new Map();

    /* ─────────────────────────────
       Clone Data Items First
    ───────────────────────────── */
    for (const doc of dataItemDocs) {
      const oldDocId = doc._id;
      const newDocCreatedAt = new Date();

      const newDoc =
        Number(doc.layer) === 2 && doc.parentDataItemId
          ? {
              ...doc,
              projectOwnerId: requesterId,
              createdByUserId: requesterId,
              projectId: newProjectId,
              parentDataItemId: doc.parentDataItemId,
              createdAt: newDocCreatedAt,
              updatedAt: newDocCreatedAt,
            }
          : {
              ...doc,
              projectOwnerId: requesterId,
              createdByUserId: requesterId,
              projectId: newProjectId,
              createdAt: newDocCreatedAt,
              updatedAt: newDocCreatedAt,
            };

      delete newDoc._id;

      const result = await engineCollection.insertOne(newDoc);
      docIdMap.set(String(oldDocId), result.insertedId);
    }

    /* ─────────────────────────────
       Remap Layer 2 Parent IDs
    ───────────────────────────── */
    for (const doc of dataItemDocs) {
      if (Number(doc.layer) !== 2 || !doc.parentDataItemId) continue;

      const newDocId = docIdMap.get(String(doc._id));
      const newParentDataItemId = docIdMap.get(String(doc.parentDataItemId));

      if (!newDocId || !newParentDataItemId) continue;

      await engineCollection.updateOne(
        {
          _id: newDocId,
          projectId: newProjectId,
          type: dataItemType,
          layer: 2,
        },
        {
          $set: {
            parentDataItemId: newParentDataItemId,
          },
        },
      );
    }

    /* ─────────────────────────────
       Clone Non-image Extension Docs
    ───────────────────────────── */
    for (const doc of extensionDocs) {
      const oldDataItemId = doc.dataItemId ? String(doc.dataItemId) : null;
      const newDataItemId = oldDataItemId ? docIdMap.get(oldDataItemId) : null;

      if (oldDataItemId && !newDataItemId) {
        continue;
      }

      const newDocCreatedAt = new Date();

      const newDoc = {
        ...doc,
        projectOwnerId: requesterId,
        createdByUserId: requesterId,
        projectId: newProjectId,
        dataItemId: newDataItemId || doc.dataItemId,
        createdAt: newDocCreatedAt,
        updatedAt: newDocCreatedAt,
      };

      delete newDoc._id;

      await engineCollection.insertOne(newDoc);
    }

    /* ─────────────────────────────
       Clone Image Docs + R2 Objects
    ───────────────────────────── */
    for (const img of imageDocs) {
      const oldDataItemId = img.dataItemId ? String(img.dataItemId) : null;
      const newDataItemId = oldDataItemId ? docIdMap.get(oldDataItemId) : null;

      if (oldDataItemId && !newDataItemId) {
        continue;
      }

      const timestamp = Date.now();
      const requesterIdString = String(requesterId);
      const dataItemIdString = String(newDataItemId || img.dataItemId);

      const baseKey =
        `users/${requesterIdString}/projects/${newProjectId}/` +
        `${collectionName}/${dataItemIdString}/${timestamp}`;

      let originalKey = "";
      let originalUrl = "";
      let thumbKey = "";
      let thumbUrl = "";

      if (img.original?.r2Key) {
        const originalBuffer = await storage.getObjectBuffer(
          img.original.r2Key,
        );

        originalKey = `${baseKey}-original.jpg`;
        originalUrl = await storage.uploadObject({
          buffer: originalBuffer,
          key: originalKey,
          contentType: "image/jpeg",
        });
      }

      if (img.thumb?.r2Key) {
        const thumbBuffer = await storage.getObjectBuffer(img.thumb.r2Key);

        thumbKey = `${baseKey}-thumb.webp`;
        thumbUrl = await storage.uploadObject({
          buffer: thumbBuffer,
          key: thumbKey,
          contentType: "image/webp",
        });
      }

      const newImageDocCreatedAt = new Date();

      const newImageDoc = {
        ...img,
        projectOwnerId: requesterId,
        createdByUserId: requesterId,
        projectId: newProjectId,
        dataItemId: newDataItemId || img.dataItemId,
        createdAt: newImageDocCreatedAt,
        updatedAt: newImageDocCreatedAt,
        original: img.original
          ? {
              ...img.original,
              r2Key: originalKey,
              url: originalUrl,
            }
          : undefined,
        thumb: img.thumb
          ? {
              ...img.thumb,
              r2Key: thumbKey,
              url: thumbUrl,
            }
          : undefined,
      };

      delete newImageDoc._id;

      await engineCollection.insertOne(newImageDoc);
    }

    return res.status(201).json({
      message: "Project cloned successfully.",
      data: {
        _id: newProjectId,
        updatedAt: clonedProject.updatedAt,
        configUpdatedAt: clonedProject.configUpdatedAt,
      },
    });
  } catch (err) {
    console.error("Clone project failed:", err);
    return res.status(500).json({
      error: "Failed to clone project.",
    });
  }
});

/* ─────────────────────────────
   GET - Export Project GeoJSON
   Access: owner OR public/open OR viewer/editor/admin
───────────────────────────── */
router.get("/export/:_id", async (req, res) => {
  const { _id } = req.params;

  if (!_id) {
    return res.status(400).json({
      error: "Missing _id.",
    });
  }

  try {
    const db = getDB();
    const projectId = new ObjectId(_id);
    const userId = new ObjectId(req.userId);

    const project = await db.collection("projects").findOne({
      _id: projectId,
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    /*
     * Access to the project is the whole check - see the clone route's
     * own comment. This route exists only because a project exported
     * from the list has no loaded data to build from, not because
     * exporting needs a privilege.
     */
    const access = hasProjectAccess(project, userId, "viewer");

    if (!access.hasAccess) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const docs = await getExportableProjectDocs(db, project);
    const geojson = buildProjectGeoJSON(project, docs);

    const safeProjectName = String(project.projectName || "project")
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .replace(/\s+/g, "-");

    res.setHeader("Content-Type", "application/geo+json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeProjectName || "project"}-${String(project._id)}.geojson"`,
    );

    return res.status(200).send(JSON.stringify(geojson, null, 2));
  } catch (err) {
    console.error("Export project failed:", err);
    return res.status(500).json({
      error: "Failed to export project.",
    });
  }
});

/* ─────────────────────────────
   PUT - Update Project
   Access: owner OR admin
───────────────────────────── */
router.put("/update/:_id", largeJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["project"])) {
    return res.status(400).json({
      error: "Invalid update project payload.",
    });
  }

  const { project } = req.body;
  const { _id } = req.params;

  const configUpdatedAt = project?.configUpdatedAt;

  if (!project || !_id || !configUpdatedAt) {
    return res.status(400).json({
      error: "Missing project data, _id, or configUpdatedAt.",
    });
  }

  if (String(project._id || "") !== String(_id)) {
    return res.status(400).json({
      error: "Invalid project payload.",
    });
  }

  try {
    const db = getDB();
    const projectId = new ObjectId(_id);
    const userId = new ObjectId(req.userId);

    const existingProject = await db.collection("projects").findOne({
      _id: projectId,
    });

    if (!existingProject) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const access = hasProjectAccess(existingProject, userId, "admin");

    if (!access.hasAccess) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const incomingConfigUpdatedAt = new Date(configUpdatedAt);
    const databaseConfigUpdatedAt = new Date(existingProject.configUpdatedAt);

    if (
      !Number.isFinite(incomingConfigUpdatedAt.getTime()) ||
      !Number.isFinite(databaseConfigUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid project config timestamp. Reload before updating.",
      });
    }

    if (
      incomingConfigUpdatedAt.getTime() !== databaseConfigUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This project's configuration has changed since you loaded it. Reload before updating.",
      });
    }

    const validation = validateProjectSchema(project, {
      existingProject,
    });

    if (!validation.isValid) {
      return res.status(400).json({
        error: buildSchemaValidationError(validation.errors),
      });
    }

    const safeProject = {
      engineKey: project.engineKey,
      projectName: project.projectName,
      projectDescription: project.projectDescription,
      projectTags: project.projectTags,
      previewText: project.previewText,
      geometry: project.geometry,
      time: project.time,
      sections: project.sections,
      extensions: project.extensions,
    };

    const collectionName = existingProject.engineKey;

    const migrationPlan = generateProjectMigrationPlan(
      existingProject,
      safeProject,
    );

    const {
      removedSectionIds = [],
      removedInputIds = [],
      removedExtensions = [],
      forceGlobalExtensions = [],
      sectionOrderChanged = false,
      inputOrderChanged = false,
      extensionLimitChanges = {},
    } = migrationPlan;

    const summary = [];

    for (const extId of removedExtensions) {
      if (extId === "Gallery") {
        const images = await db
          .collection(collectionName)
          .find({
            projectId,
            type: "image",
          })
          .toArray();

        for (const img of images) {
          if (img.original?.r2Key) {
            await storage.removeObject(img.original.r2Key);
          }

          if (img.thumb?.r2Key) {
            await storage.removeObject(img.thumb.r2Key);
          }
        }

        if (images.length > 0) {
          summary.push(`${images.length} gallery images removed`);
        }

        await db.collection(collectionName).deleteMany({
          projectId,
          type: "image",
        });
      }

      if (extId === "Guestbook") {
        const deleteResult = await db.collection(collectionName).deleteMany({
          projectId,
          type: "guestbook",
        });

        if (deleteResult.deletedCount > 0) {
          summary.push(
            `${deleteResult.deletedCount} guestbook entries removed`,
          );
        }
      }

      summary.push(`Extension "${extId}" removed from all ${collectionName}`);
    }

    for (const extId of forceGlobalExtensions) {
      summary.push(`Extension "${extId}" applied globally`);
    }

    if (removedSectionIds.length > 0) {
      summary.push(`${removedSectionIds.length} sections removed`);
    }

    if (removedInputIds.length > 0) {
      summary.push(`${removedInputIds.length} inputs removed`);
    }

    if (sectionOrderChanged) {
      summary.push("Sections reordered");
    }

    if (inputOrderChanged) {
      summary.push("Inputs reordered");
    }

    const migrationResult = await migrateProjectDataForSchemaUpdate({
      db,
      projectId,
      collectionName,
      previousProject: existingProject,
      nextProject: safeProject,
      migrationPlan,
    });

    summary.push(...migrationResult.summary);

    const existingChatEnabled =
      existingProject?.extensions?.Chat?.enabled === true;
    const nextChatEnabled = safeProject?.extensions?.Chat?.enabled === true;

    if (existingChatEnabled && !nextChatEnabled) {
      const deleteResult = await db.collection("projectChat").deleteMany({
        projectId,
        type: "projectChat",
      });

      if (deleteResult.deletedCount > 0) {
        summary.push(`${deleteResult.deletedCount} project chat docs removed`);
      }
    }

    const existingBulletinEnabled =
      existingProject?.extensions?.Bulletin?.enabled === true;
    const nextBulletinEnabled =
      safeProject?.extensions?.Bulletin?.enabled === true;

    if (existingBulletinEnabled && !nextBulletinEnabled) {
      const deleteResult = await db.collection("bulletin").deleteMany({
        projectId,
        type: "bulletin",
      });

      if (deleteResult.deletedCount > 0) {
        summary.push(`${deleteResult.deletedCount} bulletin docs removed`);
      }
    }

    if (
      !removedExtensions.includes("Gallery") &&
      extensionLimitChanges?.Gallery?.maxImagesReduced === true
    ) {
      const galleryResult = await enforceGalleryMaxImages({
        db,
        collectionName,
        projectId,
        maxImages: extensionLimitChanges.Gallery.nextMaxImages,
      });

      if (galleryResult.removedCount > 0) {
        summary.push(
          `${galleryResult.removedCount} gallery images removed due to maxImages limit`,
        );
      }
    }

    if (
      !removedExtensions.includes("Chat") &&
      nextChatEnabled === true &&
      (extensionLimitChanges?.Chat?.maxMessagesReduced === true ||
        extensionLimitChanges?.Chat?.messageLengthReduced === true)
    ) {
      const chatLimitResult = await enforceProjectChatLimits({
        db,
        projectId,
        maxMessagesReduced:
          extensionLimitChanges.Chat.maxMessagesReduced === true,
        nextMaxMessages: extensionLimitChanges.Chat.nextMaxMessages,
        messageLengthReduced:
          extensionLimitChanges.Chat.messageLengthReduced === true,
        nextMessageLength: extensionLimitChanges.Chat.nextMessageLength,
      });

      if (chatLimitResult.truncatedCount > 0) {
        summary.push(
          `${chatLimitResult.truncatedCount} project chat messages truncated`,
        );
      }

      if (chatLimitResult.removedCount > 0) {
        summary.push(
          `${chatLimitResult.removedCount} project chat messages removed due to maxMessages limit`,
        );
      }
    }

    if (
      !removedExtensions.includes("Bulletin") &&
      nextBulletinEnabled === true &&
      (extensionLimitChanges?.Bulletin?.maxMessagesReduced === true ||
        extensionLimitChanges?.Bulletin?.messageLengthReduced === true)
    ) {
      const bulletinLimitResult = await enforceBulletinLimits({
        db,
        projectId,
        maxMessagesReduced:
          extensionLimitChanges.Bulletin.maxMessagesReduced === true,
        nextMaxMessages: extensionLimitChanges.Bulletin.nextMaxMessages,
        messageLengthReduced:
          extensionLimitChanges.Bulletin.messageLengthReduced === true,
        nextMessageLength: extensionLimitChanges.Bulletin.nextMessageLength,
      });

      if (bulletinLimitResult.truncatedCount > 0) {
        summary.push(
          `${bulletinLimitResult.truncatedCount} bulletin messages truncated`,
        );
      }

      if (bulletinLimitResult.removedCount > 0) {
        summary.push(
          `${bulletinLimitResult.removedCount} bulletin messages removed due to maxMessages limit`,
        );
      }
    }

    const now = new Date();

    await db.collection("projects").updateOne(
      { _id: projectId },
      {
        $set: {
          ...safeProject,
          updatedAt: now,
          configUpdatedAt: now,
        },
      },
    );

    summary.push("Project schema updated successfully");

    return res.json({
      message: summary.join("\n"),
      data: {
        _id,
      },
    });
  } catch (err) {
    console.error("Update with migration failed:", err);
    return res.status(500).json({
      error: "Failed to update project.",
    });
  }
});

/* ─────────────────────────────
   DELETE - Remove Project
   Access: owner only
───────────────────────────── */
router.delete("/remove/:_id", tinyJson, async (req, res) => {
  if (!hasNoKeys(req.body)) {
    return res.status(400).json({
      error: "Invalid remove project payload.",
    });
  }

  const { _id } = req.params;

  if (!_id) {
    return res.status(400).json({ error: "Missing _id." });
  }

  try {
    const db = getDB();
    const projectId = new ObjectId(_id);
    const userId = new ObjectId(req.userId);

    const existingProject = await db.collection("projects").findOne({
      projectOwnerId: userId,
      _id: projectId,
    });

    if (!existingProject) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const collectionName = existingProject.engineKey;

    const projectCount = await db
      .collection("projects")
      .countDocuments({ projectOwnerId: userId });

    if (projectCount <= 1) {
      return res.status(400).json({
        error: "You must have at least one project.",
      });
    }

    let summary = [];

    const images = await db
      .collection(collectionName)
      .find({
        projectOwnerId: userId,
        projectId,
        type: "image",
      })
      .toArray();

    for (const img of images) {
      if (img.original?.r2Key) {
        await storage.removeObject(img.original.r2Key);
      }
      if (img.thumb?.r2Key) {
        await storage.removeObject(img.thumb.r2Key);
      }
    }

    if (images.length > 0) {
      summary.push(`${images.length} cloud images removed`);
    }

    const deleteResult = await db.collection(collectionName).deleteMany({
      projectOwnerId: userId,
      projectId,
    });

    if (deleteResult.deletedCount > 0) {
      summary.push(`All related ${collectionName} data removed`);
    }

    const chatDeleteResult = await db.collection("projectChat").deleteMany({
      projectId,
      type: "projectChat",
    });

    if (chatDeleteResult.deletedCount > 0) {
      summary.push(
        `${chatDeleteResult.deletedCount} project chat docs removed`,
      );
    }

    const bulletinDeleteResult = await db.collection("bulletin").deleteMany({
      projectId,
      type: "bulletin",
    });

    if (bulletinDeleteResult.deletedCount > 0) {
      summary.push(
        `${bulletinDeleteResult.deletedCount} bulletin docs removed`,
      );
    }

    /*
     * Boundaries, layers and aggregates, which live in their own
     * collections rather than in the engine collection emptied above -
     * after the data and extension documents, before the project itself.
     */
    const spatialDeleteResult = await deleteProjectSpatialDocs(db, projectId);

    summary.push(...spatialDeleteResult.summary);

    await db.collection("projects").deleteOne({
      _id: projectId,
      projectOwnerId: userId,
    });

    await db
      .collection("users")
      .updateMany(
        { "favouriteProjects._id": projectId },
        { $pull: { favouriteProjects: { _id: projectId } } },
      );

    summary.push("Project schema removed");

    return res.json({
      message: summary.join("\n"),
      data: { _id },
    });
  } catch (err) {
    console.error("Project delete failed:", err);
    return res.status(500).json({
      error: "Failed to remove project.",
    });
  }
});

/* ─────────────────────────────
   PATCH - Update Project Visibility
   Access: owner OR admin
───────────────────────────── */
router.patch("/visibility/:_id", smallJson, async (req, res) => {
  const { _id } = req.params;
  const { visibility, configUpdatedAt } = req.body;

  if (!_id || !validateProjectVisibilityPayload(req.body)) {
    return res.status(400).json({
      error: "Invalid project visibility payload.",
    });
  }

  try {
    const db = getDB();
    const projectId = new ObjectId(_id);
    const userId = new ObjectId(req.userId);

    const existingProject = await db.collection("projects").findOne({
      _id: projectId,
    });

    if (!existingProject) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const access = hasProjectAccess(existingProject, userId, "admin");

    if (!access.hasAccess) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const incomingConfigUpdatedAt = new Date(configUpdatedAt);
    const databaseConfigUpdatedAt = new Date(existingProject.configUpdatedAt);

    if (
      !Number.isFinite(incomingConfigUpdatedAt.getTime()) ||
      !Number.isFinite(databaseConfigUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error:
          "Invalid project config timestamp. Reload before updating visibility.",
      });
    }

    if (
      incomingConfigUpdatedAt.getTime() !== databaseConfigUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This project's configuration has changed since you loaded it. Reload before updating visibility.",
      });
    }

    const now = new Date();

    await db.collection("projects").updateOne(
      { _id: projectId },
      {
        $set: {
          visibility,
          updatedAt: now,
          configUpdatedAt: now,
        },
      },
    );

    if (visibility === "private") {
      const allowedIds = [
        existingProject.projectOwnerId,
        ...(existingProject.adminRole || []).map((ref) => ref?._id),
        ...(existingProject.editorRole || []).map((ref) => ref?._id),
        ...(existingProject.viewerRole || []).map((ref) => ref?._id),
      ].filter(Boolean);

      await db.collection("users").updateMany(
        {
          "favouriteProjects._id": projectId,
          _id: { $nin: allowedIds },
        },
        { $pull: { favouriteProjects: { _id: projectId } } },
      );
    }

    return res.json({
      message: `Project visibility updated to ${visibility}.`,
      data: {
        _id,
        updatedAt: now,
        configUpdatedAt: now,
      },
    });
  } catch (err) {
    console.error("Update visibility failed:", err);
    return res.status(500).json({
      error: "Failed to update project visibility.",
    });
  }
});

/* ─────────────────────────────
   PATCH - Update Project Settings (name, description, tags)
   Access: owner OR admin
───────────────────────────── */
router.patch("/settings/:_id", smallJson, async (req, res) => {
  const { _id } = req.params;

  if (!_id || !validateProjectSettingsPayload(req.body)) {
    return res.status(400).json({
      error: "Invalid project settings payload.",
    });
  }

  const { projectName, projectDescription, projectTags, configUpdatedAt } =
    req.body;

  try {
    const db = getDB();
    const projectId = new ObjectId(_id);
    const userId = new ObjectId(req.userId);

    const existingProject = await db.collection("projects").findOne({
      _id: projectId,
    });

    if (!existingProject) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const access = hasProjectAccess(existingProject, userId, "admin");

    if (!access.hasAccess) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const incomingConfigUpdatedAt = new Date(configUpdatedAt);
    const databaseConfigUpdatedAt = new Date(existingProject.configUpdatedAt);

    if (
      !Number.isFinite(incomingConfigUpdatedAt.getTime()) ||
      !Number.isFinite(databaseConfigUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error:
          "Invalid project config timestamp. Reload before updating settings.",
      });
    }

    if (
      incomingConfigUpdatedAt.getTime() !== databaseConfigUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This project's configuration has changed since you loaded it. Reload before updating settings.",
      });
    }

    const now = new Date();

    await db.collection("projects").updateOne(
      { _id: projectId },
      {
        $set: {
          projectName,
          projectDescription,
          projectTags,
          updatedAt: now,
          configUpdatedAt: now,
        },
      },
    );

    return res.json({
      message: "Project settings updated.",
      data: {
        _id,
        projectName,
        projectDescription,
        projectTags,
        updatedAt: now,
        configUpdatedAt: now,
      },
    });
  } catch (err) {
    console.error("Update project settings failed:", err);
    return res.status(500).json({
      error: "Failed to update project settings.",
    });
  }
});

/* ─────────────────────────────
   PATCH - Add Project Role
   Access: owner OR admin
───────────────────────────── */
router.patch("/roles/add/:_id", smallJson, async (req, res) => {
  const { _id } = req.params;
  const { role, userName, configUpdatedAt } = req.body;

  if (!_id || !validateProjectRolePayload(req.body)) {
    return res.status(400).json({
      error: "Invalid role payload.",
    });
  }

  try {
    const db = getDB();
    const projectId = new ObjectId(_id);
    const requesterId = new ObjectId(req.userId);
    const normalizedUserName = String(userName).trim();

    const existingProject = await db.collection("projects").findOne({
      _id: projectId,
    });

    if (!existingProject) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const access = hasProjectAccess(existingProject, requesterId, "admin");

    if (!access.hasAccess) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const incomingConfigUpdatedAt = new Date(configUpdatedAt);
    const databaseConfigUpdatedAt = new Date(existingProject.configUpdatedAt);

    if (
      !Number.isFinite(incomingConfigUpdatedAt.getTime()) ||
      !Number.isFinite(databaseConfigUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid project config timestamp. Reload before adding a role.",
      });
    }

    if (
      incomingConfigUpdatedAt.getTime() !== databaseConfigUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This project's configuration has changed since you loaded it. Reload before adding a role.",
      });
    }

    if (
      role === "viewerRole" &&
      ["public", "open"].includes(existingProject.visibility)
    ) {
      return res.status(400).json({
        error: "Viewer role does not apply to public or open projects.",
      });
    }

    if (role === "editorRole" && existingProject.visibility === "open") {
      return res.status(400).json({
        error: "Editor role does not apply to open projects.",
      });
    }

    const targetUser = await db.collection("users").findOne({
      $expr: {
        $eq: [{ $toLower: "$userName" }, normalizedUserName.toLowerCase()],
      },
    });

    if (!targetUser) {
      return res.status(404).json({
        error: "Username not found.",
      });
    }

    if (String(targetUser._id) === String(existingProject.projectOwnerId)) {
      return res.status(400).json({
        error: "Project owner does not need a project role.",
      });
    }

    const roleRank = {
      viewerRole: 1,
      editorRole: 2,
      adminRole: 3,
    };

    const roleLabel = {
      viewerRole: "viewer",
      editorRole: "editor",
      adminRole: "admin",
    };

    const viewerRole = Array.isArray(existingProject.viewerRole)
      ? existingProject.viewerRole
      : [];

    const editorRole = Array.isArray(existingProject.editorRole)
      ? existingProject.editorRole
      : [];

    const adminRole = Array.isArray(existingProject.adminRole)
      ? existingProject.adminRole
      : [];

    const targetIdString = String(targetUser._id);

    const hasViewerRole = viewerRole.some(
      (roleUser) => String(roleUser?._id) === targetIdString,
    );

    const hasEditorRole = editorRole.some(
      (roleUser) => String(roleUser?._id) === targetIdString,
    );

    const hasAdminRole = adminRole.some(
      (roleUser) => String(roleUser?._id) === targetIdString,
    );

    let existingRole = null;

    if (hasAdminRole) {
      existingRole = "adminRole";
    } else if (hasEditorRole) {
      existingRole = "editorRole";
    } else if (hasViewerRole) {
      existingRole = "viewerRole";
    }

    if (existingRole === role) {
      return res.status(400).json({
        error: `User is already in the ${roleLabel[role]} role.`,
      });
    }

    if (existingRole && roleRank[existingRole] > roleRank[role]) {
      return res.status(400).json({
        error: `${roleLabel[existingRole]} does not need ${roleLabel[role]} permissions.`,
      });
    }

    const roleUser = {
      _id: targetUser._id,
      userName: targetUser.userName,
      userColorTheme: targetUser.userColorTheme || "green",
    };

    const now = new Date();

    await db.collection("projects").updateOne(
      { _id: projectId },
      {
        $pull: {
          adminRole: { _id: targetUser._id },
          editorRole: { _id: targetUser._id },
          viewerRole: { _id: targetUser._id },
        },
        $set: {
          updatedAt: now,
          configUpdatedAt: now,
        },
      },
    );

    await db.collection("projects").updateOne(
      { _id: projectId },
      {
        $addToSet: { [role]: roleUser },
      },
    );

    return res.json({
      message: `${targetUser.userName} added to ${role}.`,
      data: {
        _id,
        userName: targetUser.userName,
        userColorTheme: targetUser.userColorTheme || "green",
        updatedAt: now,
        configUpdatedAt: now,
      },
    });
  } catch (err) {
    console.error("Add project role failed:", err);
    return res.status(500).json({
      error: "Failed to add project role.",
    });
  }
});

/* ─────────────────────────────
   PATCH - Remove Project Role
   Access: owner OR admin
───────────────────────────── */
router.patch("/roles/remove/:_id", smallJson, async (req, res) => {
  const { _id } = req.params;
  const { role, userName, configUpdatedAt } = req.body;

  if (!_id || !validateProjectRolePayload(req.body)) {
    return res.status(400).json({
      error: "Invalid role payload.",
    });
  }

  try {
    const db = getDB();
    const projectId = new ObjectId(_id);
    const requesterId = new ObjectId(req.userId);
    const normalizedUserName = String(userName).trim();

    const existingProject = await db.collection("projects").findOne({
      _id: projectId,
    });

    if (!existingProject) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const access = hasProjectAccess(existingProject, requesterId, "admin");

    if (!access.hasAccess) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const incomingConfigUpdatedAt = new Date(configUpdatedAt);
    const databaseConfigUpdatedAt = new Date(existingProject.configUpdatedAt);

    if (
      !Number.isFinite(incomingConfigUpdatedAt.getTime()) ||
      !Number.isFinite(databaseConfigUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error:
          "Invalid project config timestamp. Reload before removing a role.",
      });
    }

    if (
      incomingConfigUpdatedAt.getTime() !== databaseConfigUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This project's configuration has changed since you loaded it. Reload before removing a role.",
      });
    }

    const targetUser = await db.collection("users").findOne({
      $expr: {
        $eq: [{ $toLower: "$userName" }, normalizedUserName.toLowerCase()],
      },
    });

    if (!targetUser) {
      return res.status(404).json({
        error: "Username not found.",
      });
    }

    const targetId = targetUser._id;

    if (String(targetId) === String(existingProject.projectOwnerId)) {
      return res.status(400).json({
        error: "Project owner does not have a removable project role.",
      });
    }

    if (String(targetId) === String(requesterId)) {
      return res.status(403).json({
        error: "You cannot remove your own project role.",
      });
    }

    if (role === "adminRole" && !access.isOwner) {
      return res.status(403).json({
        error: "Only the project owner can remove an admin role.",
      });
    }

    const now = new Date();

    await db.collection("projects").updateOne(
      { _id: projectId },
      {
        $pull: { [role]: { _id: targetId } },
        $set: {
          updatedAt: now,
          configUpdatedAt: now,
        },
      },
    );

    return res.json({
      message: `${targetUser.userName} removed from ${role}.`,
      data: {
        _id,
        updatedAt: now,
        configUpdatedAt: now,
      },
    });
  } catch (err) {
    console.error("Remove project role failed:", err);
    return res.status(500).json({
      error: "Failed to remove project role.",
    });
  }
});

export default router;
