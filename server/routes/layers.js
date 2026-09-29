// server/routes/layers.js

import express from "express";
import { ObjectId } from "mongodb";
import { smallJson, largeJson } from "../middleware/bodyLimits.js";
import { getDB } from "../db.js";
import { hasProjectAccess } from "../utils/projectPermissions.js";
import { hasExactKeys } from "../../shared/validation/dataValidation.js";
import {
  validateCreateLayerPayload,
  validateUpdateLayerPayload,
} from "../../shared/validation/layerValidation.js";
import { LAYER_TOOL_LIMITS } from "../../shared/validation/validationConstants.js";

const router = express.Router();

async function loadProjectForAccess(db, projectId, userId, requiredRole) {
  const project = await db.collection("projects").findOne({
    _id: projectId,
  });

  if (!project) {
    return { project: null, access: null };
  }

  const access = hasProjectAccess(project, userId, requiredRole);
  return { project, access };
}

function toSafeLayer(layerDoc) {
  return {
    _id: layerDoc._id,
    projectId: layerDoc.projectId,
    name: layerDoc.name,
    description: layerDoc.description,
    classification: layerDoc.classification,
    fillColor: layerDoc.fillColor,
    borderColor: layerDoc.borderColor,
    opacity: layerDoc.opacity,
    visible: layerDoc.visible,
    order: layerDoc.order,
    filterState: layerDoc.filterState || {},
    createdAt: layerDoc.createdAt,
    updatedAt: layerDoc.updatedAt,
  };
}

/* ─────────────────────────────
   POST - Get All Layers
   Access: any project role (viewer+) - view-only for viewer/editor
───────────────────────────── */
router.post("/get", smallJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["projectId"])) {
    return res.status(400).json({ error: "Invalid get layers payload." });
  }

  const { projectId } = req.body;

  if (!projectId) {
    return res.status(400).json({ error: "Missing projectId." });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);

    const { project, access } = await loadProjectForAccess(
      db,
      projectObjectId,
      userId,
      "viewer",
    );

    if (!project || !access.hasAccess) {
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized." });
    }

    const layers = await db
      .collection("layers")
      .find({ projectId: projectObjectId })
      .sort({ order: 1 })
      .toArray();

    return res.json({
      message: "Layers retrieved",
      data: layers.map(toSafeLayer),
    });
  } catch (err) {
    console.error("Fetch layers failed:", err);
    return res.status(500).json({ error: "Failed to fetch layers." });
  }
});

/* ─────────────────────────────
   POST - Create Layer
   Access: admin or owner only
───────────────────────────── */
router.post("/create", largeJson, async (req, res) => {
  if (!req.body?.projectId) {
    return res.status(400).json({ error: "Missing projectId." });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(req.body.projectId);

    const { project, access } = await loadProjectForAccess(
      db,
      projectObjectId,
      userId,
      "admin",
    );

    if (!project) {
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized." });
    }

    if (!access.hasAccess) {
      return res.status(403).json({
        error: "Only the project owner or an admin can create layers.",
      });
    }

    if (!validateCreateLayerPayload(req.body)) {
      return res.status(400).json({ error: "Invalid create layer payload." });
    }

    const {
      name,
      description,
      classification,
      fillColor,
      borderColor,
      filterState,
    } = req.body;

    const existingLayerCount = await db
      .collection("layers")
      .countDocuments({ projectId: projectObjectId });

    const now = new Date();

    const newLayer = {
      projectId: projectObjectId,
      engineKey: project.engineKey,
      name: name.trim(),
      description: description || "",
      classification,
      fillColor,
      borderColor,
      opacity: LAYER_TOOL_LIMITS.defaultOpacity,
      visible: true,
      order: existingLayerCount,
      filterState,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection("layers").insertOne(newLayer);

    return res.json({
      message: "Layer created",
      data: toSafeLayer({ ...newLayer, _id: result.insertedId }),
    });
  } catch (err) {
    console.error("Create layer failed:", err);
    return res.status(500).json({ error: "Failed to create layer." });
  }
});

/* ─────────────────────────────
   POST - Update Layer
   Access: admin or owner only
───────────────────────────── */
router.post("/update", largeJson, async (req, res) => {
  if (!req.body?.projectId || !req.body?._id) {
    return res.status(400).json({ error: "Missing projectId or _id." });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(req.body.projectId);
    const layerObjectId = new ObjectId(req.body._id);

    const { project, access } = await loadProjectForAccess(
      db,
      projectObjectId,
      userId,
      "admin",
    );

    if (!project) {
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized." });
    }

    if (!access.hasAccess) {
      return res.status(403).json({
        error: "Only the project owner or an admin can edit layers.",
      });
    }

    if (!validateUpdateLayerPayload(req.body)) {
      return res.status(400).json({ error: "Invalid update layer payload." });
    }

    const {
      name,
      description,
      fillColor,
      borderColor,
      opacity,
      visible,
      order,
      filterState,
    } = req.body;

    const existingLayer = await db.collection("layers").findOne({
      _id: layerObjectId,
      projectId: projectObjectId,
    });

    if (!existingLayer) {
      return res.status(404).json({ error: "Layer not found." });
    }

    const updatedFields = {
      name: name.trim(),
      description: description || "",
      fillColor,
      borderColor,
      opacity: Number(opacity),
      visible,
      order: Number(order),
      filterState,
      updatedAt: new Date(),
    };

    await db
      .collection("layers")
      .updateOne({ _id: layerObjectId }, { $set: updatedFields });

    return res.json({
      message: "Layer updated",
      data: toSafeLayer({ ...existingLayer, ...updatedFields }),
    });
  } catch (err) {
    console.error("Update layer failed:", err);
    return res.status(500).json({ error: "Failed to update layer." });
  }
});

/* ─────────────────────────────
   DELETE - Delete Layer
   Access: admin or owner only
───────────────────────────── */
router.delete("/remove/:_id", smallJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["projectId"])) {
    return res.status(400).json({ error: "Invalid delete layer payload." });
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
    const layerObjectId = new ObjectId(_id);

    const { project, access } = await loadProjectForAccess(
      db,
      projectObjectId,
      userId,
      "admin",
    );

    if (!project) {
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized." });
    }

    if (!access.hasAccess) {
      return res.status(403).json({
        error: "Only the project owner or an admin can delete layers.",
      });
    }

    const result = await db.collection("layers").deleteOne({
      _id: layerObjectId,
      projectId: projectObjectId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Layer not found." });
    }

    return res.json({
      message: "Layer deleted",
      data: { _id },
    });
  } catch (err) {
    console.error("Delete layer failed:", err);
    return res.status(500).json({ error: "Failed to delete layer." });
  }
});

export default router;
