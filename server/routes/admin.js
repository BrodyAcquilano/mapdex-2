// server/routes/admin.js

import express from "express";
import { ObjectId } from "mongodb";

import { getDB } from "../db.js";
import { storage } from "../media/mediaService.js";
import { tinyJson } from "../middleware/bodyLimits.js";
import { ENGINE_KEYS } from "../../shared/validation/schemaConstants.js";

const router = express.Router();

function hasNoKeys(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return true;
  }

  return Object.keys(payload).length === 0;
}

function isValidObjectIdParam(value) {
  return typeof value === "string" && ObjectId.isValid(value);
}

function isAllowedEngineKey(engineKey) {
  return typeof engineKey === "string" && ENGINE_KEYS.includes(engineKey);
}

/* ─────────────────────────────
   POST - Ban User (Admin)
───────────────────────────── */
router.post("/ban/:_id", tinyJson, async (req, res) => {
  if (!hasNoKeys(req.body)) {
    return res.status(400).json({
      success: false,
      message: "Invalid ban user payload.",
    });
  }

  const { _id } = req.params;

  if (!isValidObjectIdParam(_id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid user id.",
    });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(_id);

    const result = await db.collection("users").updateOne(
      { _id: userId },
      {
        $set: {
          accountStatus: "banned",
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.json({
      success: true,
      message: "User banned.",
    });
  } catch (err) {
    console.error("Ban failed:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to ban user.",
    });
  }
});

/* ─────────────────────────────
   POST - Purge User Data (Admin)
───────────────────────────── */
router.post("/purge-data/:_id", tinyJson, async (req, res) => {
  if (!hasNoKeys(req.body)) {
    return res.status(400).json({
      success: false,
      message: "Invalid purge user data payload.",
    });
  }

  const { _id } = req.params;

  if (!isValidObjectIdParam(_id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid user id.",
    });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(_id);
    const now = new Date();

    await db.collection("projects").updateMany(
      {
        projectOwnerId: { $ne: userId },
        $or: [
          { "adminRole._id": userId },
          { "editorRole._id": userId },
          { "viewerRole._id": userId },
        ],
      },
      {
        $pull: {
          adminRole: { _id: userId },
          editorRole: { _id: userId },
          viewerRole: { _id: userId },
        },
        $set: {
          updatedAt: now,
          configUpdatedAt: now,
        },
      },
    );

    const projects = await db
      .collection("projects")
      .find({ projectOwnerId: userId })
      .toArray();

    for (const project of projects) {
      const collectionName = project.engineKey;

      if (!isAllowedEngineKey(collectionName)) {
        console.warn(
          `Skipping purge for project ${project._id}: invalid engineKey "${collectionName}".`,
        );
        continue;
      }

      const images = await db
        .collection(collectionName)
        .find({
          projectOwnerId: userId,
          projectId: project._id,
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

      await db.collection(collectionName).deleteMany({
        projectOwnerId: userId,
        projectId: project._id,
      });
    }

    const projectIds = projects.map((project) => project._id);

    if (projectIds.length > 0) {
      await db.collection("projectChat").deleteMany({
        projectId: { $in: projectIds },
        type: "projectChat",
      });

      await db.collection("bulletin").deleteMany({
        projectId: { $in: projectIds },
        type: "bulletin",
      });
    }

    await db.collection("projects").deleteMany({
      projectOwnerId: userId,
    });

    await db.collection("users").updateOne(
      { _id: userId },
      {
        $set: {
          accountStatus: "banned",
          updatedAt: now,
        },
      },
    );

    return res.json({
      success: true,
      message: "User data purged.",
    });
  } catch (err) {
    console.error("Purge failed:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to purge user data.",
    });
  }
});

export default router;