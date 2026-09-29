// server/routes/boundaries.js

import express from "express";
import { ObjectId } from "mongodb";
import { smallJson, mediumJson } from "../middleware/bodyLimits.js";
import { getDB } from "../db.js";
import { hasProjectAccess } from "../utils/projectPermissions.js";
import { hasExactKeys } from "../../shared/validation/dataValidation.js";
import {
  validateCreateBoundaryPayload,
  validateUpdateBoundaryPayload,
  validateUpdateBoundaryGeometryPayload,
} from "../../shared/validation/aggregateValidation.js";

const router = express.Router();

async function loadProjectForAccess(db, projectId, userId, requiredRole) {
  const project = await db.collection("projects").findOne({ _id: projectId });

  if (!project) {
    return { project: null, access: null };
  }

  const access = hasProjectAccess(project, userId, requiredRole);
  return { project, access };
}

function toSafeBoundary(boundaryDoc) {
  return {
    _id: boundaryDoc._id,
    projectId: boundaryDoc.projectId,
    name: boundaryDoc.name,
    geometry: boundaryDoc.geometry,
    fillColor: boundaryDoc.fillColor,
    borderColor: boundaryDoc.borderColor,
    createdAt: boundaryDoc.createdAt,
    updatedAt: boundaryDoc.updatedAt,
  };
}

/* ─────────────────────────────
   POST - Get All Boundaries
   Access: any project role (viewer+)
───────────────────────────── */
router.post("/get", smallJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["projectId"])) {
    return res.status(400).json({ error: "Invalid get boundaries payload." });
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

    const boundaries = await db
      .collection("boundaries")
      .find({ projectId: projectObjectId })
      .sort({ createdAt: 1 })
      .toArray();

    return res.json({
      message: "Boundaries retrieved",
      data: boundaries.map(toSafeBoundary),
    });
  } catch (err) {
    console.error("Fetch boundaries failed:", err);
    return res.status(500).json({ error: "Failed to fetch boundaries." });
  }
});

/* ─────────────────────────────
   POST - Create Boundary (draw or import - both resolve to a raw
   geometry client-side, this route doesn't care which)
   Access: admin or owner only
───────────────────────────── */
router.post("/create", mediumJson, async (req, res) => {
  if (!validateCreateBoundaryPayload(req.body)) {
    return res.status(400).json({ error: "Invalid create boundary payload." });
  }

  const { projectId, name, geometry, fillColor, borderColor } = req.body;

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
        error: "Only the project owner or an admin can create boundaries.",
      });
    }

    const now = new Date();

    const newBoundary = {
      projectId: projectObjectId,
      engineKey: project.engineKey,
      /*
       * Nothing in the running app reads this - a boundary is only
       * ever loaded through this route's own collection - but every
       * export now emits each boundary as a real GeoJSON Feature
       * alongside the project's place/event features, and stamping the
       * feature type at write time is what makes those mixed
       * collections self-describing (see buildBoundaryFeature in
       * shared/exports/geoJSONExport.js). Layers and aggregates get no
       * equivalent field: they aren't features, and they export inside
       * the FeatureCollection's own properties instead.
       */
      type: "boundary",
      name: name.trim(),
      geometry,
      fillColor,
      borderColor,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection("boundaries").insertOne(newBoundary);

    return res.json({
      message: "Boundary created",
      data: toSafeBoundary({ ...newBoundary, _id: result.insertedId }),
    });
  } catch (err) {
    console.error("Create boundary failed:", err);
    return res.status(500).json({ error: "Failed to create boundary." });
  }
});

/* ─────────────────────────────
   POST - Update Boundary (name + display color - geometry isn't
   editable through this route, see /update-geometry below)
   Access: admin or owner only
───────────────────────────── */
router.post("/update", smallJson, async (req, res) => {
  if (!validateUpdateBoundaryPayload(req.body)) {
    return res.status(400).json({ error: "Invalid update boundary payload." });
  }

  const { projectId, _id, name, fillColor, borderColor } = req.body;

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);
    const boundaryObjectId = new ObjectId(_id);

    const { project, access } = await loadProjectForAccess(db, projectObjectId, userId, "admin");

    if (!project) {
      return res.status(404).json({ error: "Project not found or unauthorized." });
    }

    if (!access.hasAccess) {
      return res.status(403).json({
        error: "Only the project owner or an admin can edit boundaries.",
      });
    }

    const existingBoundary = await db.collection("boundaries").findOne({
      _id: boundaryObjectId,
      projectId: projectObjectId,
    });

    if (!existingBoundary) {
      return res.status(404).json({ error: "Boundary not found." });
    }

    const updatedFields = { name: name.trim(), fillColor, borderColor, updatedAt: new Date() };

    await db
      .collection("boundaries")
      .updateOne({ _id: boundaryObjectId }, { $set: updatedFields });

    return res.json({
      message: "Boundary updated",
      data: toSafeBoundary({ ...existingBoundary, ...updatedFields }),
    });
  } catch (err) {
    console.error("Update boundary failed:", err);
    return res.status(500).json({ error: "Failed to update boundary." });
  }
});

/* ─────────────────────────────
   POST - Update Boundary Geometry (Move Vertex / Move Boundary map
   tools - a separate route from /update above, which only ever
   touches name)
   Access: admin or owner only
───────────────────────────── */
router.post("/update-geometry", mediumJson, async (req, res) => {
  if (!validateUpdateBoundaryGeometryPayload(req.body)) {
    return res.status(400).json({ error: "Invalid update boundary geometry payload." });
  }

  const { projectId, _id, geometry } = req.body;

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);
    const boundaryObjectId = new ObjectId(_id);

    const { project, access } = await loadProjectForAccess(db, projectObjectId, userId, "admin");

    if (!project) {
      return res.status(404).json({ error: "Project not found or unauthorized." });
    }

    if (!access.hasAccess) {
      return res.status(403).json({
        error: "Only the project owner or an admin can edit boundaries.",
      });
    }

    const existingBoundary = await db.collection("boundaries").findOne({
      _id: boundaryObjectId,
      projectId: projectObjectId,
    });

    if (!existingBoundary) {
      return res.status(404).json({ error: "Boundary not found." });
    }

    const updatedFields = { geometry, updatedAt: new Date() };

    await db
      .collection("boundaries")
      .updateOne({ _id: boundaryObjectId }, { $set: updatedFields });

    return res.json({
      message: "Boundary geometry updated",
      data: toSafeBoundary({ ...existingBoundary, ...updatedFields }),
    });
  } catch (err) {
    console.error("Update boundary geometry failed:", err);
    return res.status(500).json({ error: "Failed to update boundary geometry." });
  }
});

/* ─────────────────────────────
   DELETE - Delete Boundary
   Access: admin or owner only - blocked while any aggregate still
   references it, since an aggregate has no geometry of its own.
───────────────────────────── */
router.delete("/remove/:_id", smallJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["projectId"])) {
    return res.status(400).json({ error: "Invalid delete boundary payload." });
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
    const boundaryObjectId = new ObjectId(_id);

    const { project, access } = await loadProjectForAccess(db, projectObjectId, userId, "admin");

    if (!project) {
      return res.status(404).json({ error: "Project not found or unauthorized." });
    }

    if (!access.hasAccess) {
      return res.status(403).json({
        error: "Only the project owner or an admin can delete boundaries.",
      });
    }

    /*
     * A boundary in use cannot be deleted.
     *
     * Letting it go would leave the layer or aggregate still naming it
     * in its own filterState: the map would quietly fall back to no
     * clip, but the stored document - and any export of it - would go
     * on referencing a boundary that no longer exists. Refusing the
     * delete keeps the documents honest (Brody's own call).
     *
     * The lookup reads filterState.geometry.boundaryId, which is where
     * a boundary reference lives now. The original guard queried a root
     * boundaryId field that no longer exists, so it had silently
     * stopped blocking anything.
     */
    const boundaryIdString = String(boundaryObjectId);

    const referencingQuery = {
      projectId: projectObjectId,
      "filterState.geometry.boundaryId": boundaryIdString,
    };

    const [referencingAggregate, referencingLayer] = await Promise.all([
      db.collection("aggregates").findOne(referencingQuery),
      db.collection("layers").findOne(referencingQuery),
    ]);

    if (referencingAggregate || referencingLayer) {
      const usedBy = referencingAggregate ? "an aggregate" : "a layer";
      const name = (referencingAggregate || referencingLayer).name;

      return res.status(409).json({
        error: `This boundary is still used by ${usedBy} ("${name}") - change or delete that first.`,
      });
    }

    const result = await db.collection("boundaries").deleteOne({
      _id: boundaryObjectId,
      projectId: projectObjectId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Boundary not found." });
    }

    return res.json({ message: "Boundary deleted", data: { _id } });
  } catch (err) {
    console.error("Delete boundary failed:", err);
    return res.status(500).json({ error: "Failed to delete boundary." });
  }
});

export default router;
