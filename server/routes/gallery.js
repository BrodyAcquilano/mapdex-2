import express from "express";
import { smallJson } from "../middleware/bodyLimits.js";
import { galleryImageUpload } from "../middleware/uploadLimits.js";
import { ObjectId } from "mongodb";
import sharp from "sharp";
import { getDB } from "../db.js";
import { storage } from "../media/mediaService.js";
import { buildSharpTransformPlan } from "../media/thumbnailGenerator.js";
import { hasProjectAccess } from "../utils/projectPermissions.js";
import {
  validateGalleryAddPayload,
  validateGalleryGetPayload,
  validateGalleryImageUpload,
  validateGalleryRemoveAllPayload,
  validateGalleryRemovePayload,
} from "../../shared/validation/galleryContentValidation.js";

const router = express.Router();

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

function getDataItemType(engineKey) {
  const typeByEngineKey = {
    places: "place",
    events: "event",
    neighbourhoods: "neighbourhood",
    presence: "presence",
  };

  return typeByEngineKey[engineKey] || "";
}

async function getAuthorizedParentDataItem({
  db,
  engineKey,
  projectObjectId,
  dataItemObjectId,
  userId,
  access,
}) {
  const dataItemType = getDataItemType(engineKey);

  if (!dataItemType) {
    return {
      dataItem: null,
      status: 400,
      error: "Invalid engineKey.",
    };
  }

  const dataItem = await db.collection(engineKey).findOne({
    projectId: projectObjectId,
    _id: dataItemObjectId,
    type: dataItemType,
  });

  if (!dataItem) {
    return {
      dataItem: null,
      status: 404,
      error: "Data item not found or unauthorized.",
    };
  }

  const isPresenceEngine = engineKey === "presence";
  const canEditAny = !isPresenceEngine && access.isAdmin;
  const isCreatedByUser =
    String(dataItem.createdByUserId || "") === String(userId);

  if (!canEditAny && !isCreatedByUser) {
    return {
      dataItem: null,
      status: 403,
      error: isPresenceEngine
        ? "You can only update gallery images for your own presence data."
        : "Editors can only update gallery images for data they created.",
    };
  }

  return {
    dataItem,
    status: 200,
    error: null,
  };
}

/* ─────────────────────────────────────────────
   POST - Get All (by dataItemId)
───────────────────────────────────────────── */
router.post("/get", smallJson, async (req, res) => {
  const payloadValidation = validateGalleryGetPayload(req.body);

  if (!payloadValidation.isValid) {
    return res.status(400).json({
      error: payloadValidation.error,
    });
  }

  const { projectId, dataItemId, engineKey } = req.body;

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);
    const dataItemObjectId = new ObjectId(dataItemId);

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

    const images = await db
      .collection(engineKey)
      .find({
        projectId: projectObjectId,
        dataItemId: dataItemObjectId,
        type: "image",
      })
      .sort({ createdAt: 1 })
      .toArray();

    if (images.length === 0) {
      return res.json({
        message: "No gallery images found",
        data: [],
      });
    }

    return res.json({
      message: "Gallery images retrieved",
      data: images,
    });
  } catch (err) {
    console.error("Gallery get failed:", err);
    return res.status(500).json({
      error: "Failed to fetch gallery images",
    });
  }
});

/* ─────────────────────────────────────────────
   POST - Add Image
───────────────────────────────────────────── */
router.post("/add", galleryImageUpload.single("image"), async (req, res) => {
  const payloadValidation = validateGalleryAddPayload(req.body);

  if (!payloadValidation.isValid) {
    return res.status(400).json({
      error: payloadValidation.error,
    });
  }

  if (!req.file) {
    return res.status(400).json({
      error: "Missing image file.",
    });
  }

  const { projectId, dataItemId, engineKey } = req.body;

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);
    const dataItemObjectId = new ObjectId(dataItemId);

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

    const parentCheck = await getAuthorizedParentDataItem({
      db,
      engineKey,
      projectObjectId,
      dataItemObjectId,
      userId,
      access,
    });

    if (!parentCheck.dataItem) {
      return res.status(parentCheck.status).json({
        error: parentCheck.error,
      });
    }

    const existingImageCount = await db.collection(engineKey).countDocuments({
      projectId: projectObjectId,
      dataItemId: dataItemObjectId,
      type: "image",
    });

    const galleryValidation = validateGalleryImageUpload({
      schema: project,
      dataItem: parentCheck.dataItem,
      existingImageCount,
    });

    if (!galleryValidation.isValid) {
      return res.status(400).json({
        error: galleryValidation.error,
      });
    }

    const metadata = await sharp(req.file.buffer).metadata();

    if (!metadata.width || !metadata.height) {
      return res.status(400).json({
        error: "Invalid image file.",
      });
    }

    const timestamp = Date.now();
    const projectOwnerIdString = String(project.projectOwnerId);

    const baseKey = `users/${projectOwnerIdString}/projects/${projectId}/${engineKey}/${dataItemId}/${timestamp}`;

    const originalKey = `${baseKey}-original.jpg`;

    const originalBuffer = await sharp(req.file.buffer)
      .rotate()
      .jpeg({ quality: 90 })
      .toBuffer();

    const originalUrl = await storage.uploadObject({
      buffer: originalBuffer,
      key: originalKey,
      contentType: "image/jpeg",
    });

    const plan = buildSharpTransformPlan({
      srcWidth: metadata.width,
      srcHeight: metadata.height,
      targetMaxWidth: 500,
    });

    let thumbPipeline = sharp(req.file.buffer).rotate();

    if (plan.crop) {
      thumbPipeline = thumbPipeline.extract(plan.crop);
    }

    thumbPipeline = thumbPipeline.resize(
      plan.resize.width,
      plan.resize.height,
      { fit: plan.stretch ? "fill" : "cover" },
    );

    const thumbBuffer = await thumbPipeline.webp({ quality: 70 }).toBuffer();

    const thumbKey = `${baseKey}-thumb.webp`;

    const thumbUrl = await storage.uploadObject({
      buffer: thumbBuffer,
      key: thumbKey,
      contentType: "image/webp",
    });

    const now = new Date();

    const doc = {
      projectOwnerId: project.projectOwnerId,
      createdByUserId: parentCheck.dataItem.createdByUserId,
      projectId: projectObjectId,
      dataItemId: dataItemObjectId,
      type: "image",
      original: {
        r2Key: originalKey,
        url: originalUrl,
        width: metadata.width,
        height: metadata.height,
      },
      thumb: {
        r2Key: thumbKey,
        url: thumbUrl,
        width: plan.resize.width,
        height: plan.resize.height,
      },
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection(engineKey).insertOne(doc);

    return res.status(201).json({
      message: "Image added",
      data: { _id: result.insertedId, ...doc },
    });
  } catch (err) {
    console.error("Gallery add failed:", err);
    return res.status(500).json({
      error: "Failed to add image",
    });
  }
});

/* ─────────────────────────────────────────────
   POST - Remove Single Image
───────────────────────────────────────────── */
router.post("/remove", smallJson, async (req, res) => {
  const payloadValidation = validateGalleryRemovePayload(req.body);

  if (!payloadValidation.isValid) {
    return res.status(400).json({
      error: payloadValidation.error,
    });
  }

  const { projectId, imageId, engineKey } = req.body;

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);
    const imageObjectId = new ObjectId(imageId);

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

    const image = await db.collection(engineKey).findOne({
      _id: imageObjectId,
      projectId: projectObjectId,
      type: "image",
    });

    if (!image) {
      return res.status(404).json({
        error: "Image not found",
      });
    }

    const parentCheck = await getAuthorizedParentDataItem({
      db,
      engineKey,
      projectObjectId,
      dataItemObjectId: image.dataItemId,
      userId,
      access,
    });

    if (!parentCheck.dataItem) {
      return res.status(parentCheck.status).json({
        error: parentCheck.error,
      });
    }

    if (image.original?.r2Key) {
      await storage.removeObject(image.original.r2Key);
    }

    if (image.thumb?.r2Key) {
      await storage.removeObject(image.thumb.r2Key);
    }

    const deleteResult = await db.collection(engineKey).deleteOne({
      _id: image._id,
      projectId: projectObjectId,
      type: "image",
    });

    if (deleteResult.deletedCount !== 1) {
      return res.json({
        message: "No image removed",
        data: { _id: imageId, deleted: false },
      });
    }

    return res.json({
      message: "Image removed",
      data: { _id: imageId, deleted: true },
    });
  } catch (err) {
    console.error("Gallery remove failed:", err);
    return res.status(500).json({
      error: "Failed to remove image",
    });
  }
});

/* ─────────────────────────────────────────────
   POST - Remove All (by dataItemId)
───────────────────────────────────────────── */
router.post("/remove-all", smallJson, async (req, res) => {
  const payloadValidation = validateGalleryRemoveAllPayload(req.body);

  if (!payloadValidation.isValid) {
    return res.status(400).json({
      error: payloadValidation.error,
    });
  }

  const { projectId, dataItemId, engineKey } = req.body;

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);
    const dataItemObjectId = new ObjectId(dataItemId);

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

    const parentCheck = await getAuthorizedParentDataItem({
      db,
      engineKey,
      projectObjectId,
      dataItemObjectId,
      userId,
      access,
    });

    if (!parentCheck.dataItem) {
      return res.status(parentCheck.status).json({
        error: parentCheck.error,
      });
    }

    const dataItems = await db
      .collection(engineKey)
      .find({
        projectId: projectObjectId,
        dataItemId: dataItemObjectId,
        type: "image",
      })
      .toArray();

    if (dataItems.length === 0) {
      return res.json({
        message: "No gallery images to remove",
        data: { dataItemId, deletedCount: 0 },
      });
    }

    for (const img of dataItems) {
      if (img.original?.r2Key) {
        await storage.removeObject(img.original.r2Key);
      }

      if (img.thumb?.r2Key) {
        await storage.removeObject(img.thumb.r2Key);
      }
    }

    const deleteResult = await db.collection(engineKey).deleteMany({
      projectId: projectObjectId,
      dataItemId: dataItemObjectId,
      type: "image",
    });

    return res.json({
      message:
        deleteResult.deletedCount > 0
          ? "Gallery images removed"
          : "No gallery images to remove",
      data: {
        dataItemId,
        deletedCount: deleteResult.deletedCount,
      },
    });
  } catch (err) {
    console.error("Gallery remove-all failed:", err);
    return res.status(500).json({
      error: "Failed to remove gallery images",
    });
  }
});

export default router;