// server/routes/aggregates.js

import express from "express";
import { ObjectId } from "mongodb";
import { smallJson, largeJson } from "../middleware/bodyLimits.js";
import { getDB } from "../db.js";
import { hasProjectAccess } from "../utils/projectPermissions.js";
import { hasExactKeys } from "../../shared/validation/dataValidation.js";
import {
  validateCreateAggregatePayload,
  validateUpdateAggregatePayload,
  areAggregateFieldsAllowedBySchema,
} from "../../shared/validation/aggregateValidation.js";
import { AGGREGATE_TOOL_LIMITS } from "../../shared/validation/validationConstants.js";

const router = express.Router();

async function loadProjectForAccess(db, projectId, userId, requiredRole) {
  const project = await db.collection("projects").findOne({ _id: projectId });

  if (!project) {
    return { project: null, access: null };
  }

  const access = hasProjectAccess(project, userId, requiredRole);
  return { project, access };
}

function toSafeAggregate(aggregateDoc) {
  return {
    _id: aggregateDoc._id,
    projectId: aggregateDoc.projectId,
    name: aggregateDoc.name,
    description: aggregateDoc.description,
    fillColor: aggregateDoc.fillColor,
    borderColor: aggregateDoc.borderColor,
    opacity: aggregateDoc.opacity,
    visible: aggregateDoc.visible,
    order: aggregateDoc.order,

    filterState: aggregateDoc.filterState || {},
    fields: Array.isArray(aggregateDoc.fields) ? aggregateDoc.fields : [],
    createdAt: aggregateDoc.createdAt,
    updatedAt: aggregateDoc.updatedAt,
  };
}

/* ─────────────────────────────
   POST - Get All Aggregates
   Access: any project role (viewer+) - view-only for viewer/editor
───────────────────────────── */
router.post("/get", smallJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["projectId"])) {
    return res.status(400).json({ error: "Invalid get aggregates payload." });
  }

  const { projectId } = req.body;

  if (!projectId) {
    return res.status(400).json({ error: "Missing projectId." });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);

    const { project, access } = await loadProjectForAccess(db, projectObjectId, userId, "viewer");

    if (!project || !access.hasAccess) {
      return res.status(404).json({ error: "Project not found or unauthorized." });
    }

    const aggregates = await db
      .collection("aggregates")
      .find({ projectId: projectObjectId })
      .sort({ order: 1 })
      .toArray();

    return res.json({
      message: "Aggregates retrieved",
      data: aggregates.map(toSafeAggregate),
    });
  } catch (err) {
    console.error("Fetch aggregates failed:", err);
    return res.status(500).json({ error: "Failed to fetch aggregates." });
  }
});

/* ─────────────────────────────
   POST - Create Aggregate
   Access: admin or owner only
───────────────────────────── */
router.post("/create", largeJson, async (req, res) => {
  if (!validateCreateAggregatePayload(req.body)) {
    return res.status(400).json({ error: "Invalid create aggregate payload." });
  }

  const {
    projectId,
    name,
    description,
    fillColor,
    borderColor,
    filterState,
    fields,
  } = req.body;

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);

    const { project, access } = await loadProjectForAccess(db, projectObjectId, userId, "admin");

    if (!project) {
      return res.status(404).json({ error: "Project not found or unauthorized." });
    }

    if (!access.hasAccess) {
      return res.status(403).json({
        error: "Only the project owner or an admin can create aggregates.",
      });
    }

    /*
     * The schema-aware half of field validation - see
     * areAggregateFieldsAllowedBySchema. validateCreateAggregatePayload
     * above only checked each entry's shape, which cannot tell a real
     * input from a fabricated one, a checkbox claiming to be a number,
     * or a checkboxGate primary from a countable secondary. The project
     * is loaded by this point, so the real check runs here.
     */
    if (!areAggregateFieldsAllowedBySchema(project, fields)) {
      return res.status(400).json({
        error: "One or more selected fields cannot be aggregated.",
      });
    }


    const existingAggregateCount = await db
      .collection("aggregates")
      .countDocuments({ projectId: projectObjectId });

    const now = new Date();

    const newAggregate = {
      projectId: projectObjectId,
      engineKey: project.engineKey,
      name: name.trim(),
      description: description || "",
      fillColor,
      borderColor,
      opacity: AGGREGATE_TOOL_LIMITS.defaultOpacity,
      visible: true,
      /*
       * 1-indexed, not existingAggregateCount directly - Brody's own
       * call, so the first aggregate created reads "Order: 1" in
       * AggregateEditPanel.jsx rather than "Order: 0". Nothing else
       * treats this value as a zero-based array index (it's only ever
       * used as a sort key - see the GET route's own .sort({order: 1})
       * below - and this display badge), so there's no corresponding
       * "decrement by 1" needed anywhere else, unlike the Layers tool's
       * own `order`, which starts saved layers at 1 because the Data
       * Layer itself already occupies 0.
       */
      order: existingAggregateCount + 1,
      filterState,
      fields,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection("aggregates").insertOne(newAggregate);

    return res.json({
      message: "Aggregate created",
      data: toSafeAggregate({ ...newAggregate, _id: result.insertedId }),
    });
  } catch (err) {
    console.error("Create aggregate failed:", err);
    return res.status(500).json({ error: "Failed to create aggregate." });
  }
});

/* ─────────────────────────────
   POST - Update Aggregate (full document - see
   validateUpdateAggregatePayload's own comment)
   Access: admin or owner only
───────────────────────────── */
router.post("/update", smallJson, async (req, res) => {
  if (!validateUpdateAggregatePayload(req.body)) {
    return res.status(400).json({ error: "Invalid update aggregate payload." });
  }

  const {
    projectId,
    _id,
    name,
    description,
    fillColor,
    borderColor,
    filterState,
    fields,
    opacity,
    visible,
    order,
  } = req.body;

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);
    const aggregateObjectId = new ObjectId(_id);

    const { project, access } = await loadProjectForAccess(db, projectObjectId, userId, "admin");

    if (!project) {
      return res.status(404).json({ error: "Project not found or unauthorized." });
    }

    if (!access.hasAccess) {
      return res.status(403).json({
        error: "Only the project owner or an admin can edit aggregates.",
      });
    }


    /*
     * Fields are editable now (the Edit Fields branch), so the same
     * schema-aware check the create route runs applies here too - see
     * areAggregateFieldsAllowedBySchema.
     */
    if (!areAggregateFieldsAllowedBySchema(project, fields)) {
      return res.status(400).json({
        error: "One or more selected fields cannot be aggregated.",
      });
    }

    const existingAggregate = await db.collection("aggregates").findOne({
      _id: aggregateObjectId,
      projectId: projectObjectId,
    });

    if (!existingAggregate) {
      return res.status(404).json({ error: "Aggregate not found." });
    }

    const updatedFields = {
      name: name.trim(),
      description: description || "",
      fillColor,
      borderColor,
      filterState,
      fields,
      opacity: Number(opacity),
      visible,
      order: Number(order),
      updatedAt: new Date(),
    };

    await db
      .collection("aggregates")
      .updateOne({ _id: aggregateObjectId }, { $set: updatedFields });

    return res.json({
      message: "Aggregate updated",
      data: toSafeAggregate({ ...existingAggregate, ...updatedFields }),
    });
  } catch (err) {
    console.error("Update aggregate failed:", err);
    return res.status(500).json({ error: "Failed to update aggregate." });
  }
});

/* ─────────────────────────────
   DELETE - Delete Aggregate
   Access: admin or owner only
───────────────────────────── */
router.delete("/remove/:_id", smallJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["projectId"])) {
    return res.status(400).json({ error: "Invalid delete aggregate payload." });
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
    const aggregateObjectId = new ObjectId(_id);

    const { project, access } = await loadProjectForAccess(db, projectObjectId, userId, "admin");

    if (!project) {
      return res.status(404).json({ error: "Project not found or unauthorized." });
    }

    if (!access.hasAccess) {
      return res.status(403).json({
        error: "Only the project owner or an admin can delete aggregates.",
      });
    }

    const result = await db.collection("aggregates").deleteOne({
      _id: aggregateObjectId,
      projectId: projectObjectId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Aggregate not found." });
    }

    return res.json({ message: "Aggregate deleted", data: { _id } });
  } catch (err) {
    console.error("Delete aggregate failed:", err);
    return res.status(500).json({ error: "Failed to delete aggregate." });
  }
});

export default router;
