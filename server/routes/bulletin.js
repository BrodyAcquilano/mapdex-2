import express from "express";
import { smallJson } from "../middleware/bodyLimits.js";
import { ObjectId } from "mongodb";
import { nanoid } from "nanoid";
import { getDB } from "../db.js";
import { hasProjectAccess } from "../utils/projectPermissions.js";

import {
  cleanBulletinMessagePayload,
  getBulletinConfig,
  validateBulletinAddPayload,
  validateBulletinEnabled,
  validateBulletinGetPayload,
  validateBulletinMessagePayload,
  validateBulletinRemovePayload,
  validateBulletinUpdatePayload,
} from "../../shared/validation/bulletinContentValidation.js";

const router = express.Router();

const COLLECTION_NAME = "bulletin";
const DOC_TYPE = "bulletin";

/* ─────────────────────────────
   Helpers
───────────────────────────── */

function findMessageIndex(messages, messageId) {
  return Array.isArray(messages)
    ? messages.findIndex((msg) => msg.id === messageId)
    : -1;
}

function sanitizeBulletinMessageForClient(message, authUserId, access) {
  const canEditAny =
    access.resolvedRole === "owner" || access.resolvedRole === "admin";

  const isOwnMessage = String(message?.senderId || "") === String(authUserId);

  return {
    id: message?.id || "",
    senderName: message?.senderName || "Unknown",
    title: typeof message?.title === "string" ? message.title : "",
    body: typeof message?.body === "string" ? message.body : "",
    createdAt: message?.createdAt || null,
    updatedAt: message?.updatedAt || null,
    userRole: canEditAny || isOwnMessage ? "editor" : "viewer",
  };
}

function sanitizeBulletinMessagesForClient(messages, authUserId, access) {
  return Array.isArray(messages)
    ? messages.map((message) =>
        sanitizeBulletinMessageForClient(message, authUserId, access),
      )
    : [];
}

/* ─────────────────────────────
   POST - Get All Bulletin Messages
───────────────────────────── */
router.post("/get", smallJson, async (req, res) => {
  const payloadValidation = validateBulletinGetPayload(req.body);

  if (!payloadValidation.isValid) {
    return res.status(400).json({
      error: payloadValidation.error,
    });
  }

  const { projectId } = req.body;

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

    const enabledValidation = validateBulletinEnabled(project);

    if (!enabledValidation.isValid) {
      return res.status(404).json({
        error: enabledValidation.error,
      });
    }

    const bulletinConfig = getBulletinConfig(project);

    const doc = await db.collection(COLLECTION_NAME).findOne({
      projectId: projectObjectId,
      type: DOC_TYPE,
    });

    if (!doc || !Array.isArray(doc.messages) || doc.messages.length === 0) {
      return res.json({
        message: "No bulletin messages found",
        data: {
          messages: [],
          maxMessages: bulletinConfig.maxMessages,
          messageLength: bulletinConfig.messageLength,
          titleLength: bulletinConfig.titleLength,
        },
      });
    }

    const safeMessages = sanitizeBulletinMessagesForClient(
      doc.messages,
      authUserId,
      access,
    );

    return res.json({
      message: "Bulletin messages retrieved",
      data: {
        messages: safeMessages,
        maxMessages: bulletinConfig.maxMessages,
        messageLength: bulletinConfig.messageLength,
        titleLength: bulletinConfig.titleLength,
      },
    });
  } catch (err) {
    console.error("Bulletin fetch failed:", err);
    return res.status(500).json({
      error: "Failed to fetch bulletin",
    });
  }
});

/* ─────────────────────────────
   POST - Add Bulletin Message
───────────────────────────── */
router.post("/add", smallJson, async (req, res) => {
  const payloadValidation = validateBulletinAddPayload(req.body);

  if (!payloadValidation.isValid) {
    return res.status(400).json({
      error: payloadValidation.error,
    });
  }

  const { projectId, bulletinMessage } = req.body;

  try {
    const db = getDB();
    const authUserId = new ObjectId(req.userId);
    const authUserIdString = String(authUserId);
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

    const access = hasProjectAccess(project, authUserId, "editor");

    if (!access.hasAccess) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const enabledValidation = validateBulletinEnabled(project);

    if (!enabledValidation.isValid) {
      return res.status(404).json({
        error: enabledValidation.error,
      });
    }

    const messageValidation = validateBulletinMessagePayload(
      project,
      bulletinMessage,
    );

    if (!messageValidation.isValid) {
      return res.status(400).json({
        error: messageValidation.error,
      });
    }

    const safeBulletinMessage = cleanBulletinMessagePayload(bulletinMessage);

    if (!safeBulletinMessage) {
      return res.status(400).json({
        error: "Invalid bulletin message.",
      });
    }

    const bulletinConfig = getBulletinConfig(project);

    const existingDoc = await db.collection(COLLECTION_NAME).findOne({
      projectId: projectObjectId,
      type: DOC_TYPE,
    });

    const currentMessages = Array.isArray(existingDoc?.messages)
      ? existingDoc.messages
      : [];

    if (currentMessages.length >= bulletinConfig.maxMessages) {
      return res.status(400).json({
        error: "Bulletin is already at max messages.",
      });
    }

    const newMessage = {
      id: nanoid(),
      senderId: authUserIdString,
      senderName: req.userName || "Unknown",
      title: safeBulletinMessage.title,
      body: safeBulletinMessage.body,
      createdAt: now,
      updatedAt: now,
    };

    if (!existingDoc) {
      const newDoc = {
        projectOwnerId: project.projectOwnerId,
        projectId: projectObjectId,
        type: DOC_TYPE,
        messages: [newMessage],
        createdAt: now,
        updatedAt: now,
      };

      await db.collection(COLLECTION_NAME).insertOne(newDoc);

      return res.status(201).json({
        message: "Bulletin message added",
        data: {
          message: sanitizeBulletinMessageForClient(
            newMessage,
            authUserId,
            access,
          ),
        },
      });
    }

    const nextMessages = [...currentMessages, newMessage];

    await db.collection(COLLECTION_NAME).updateOne(
      { _id: existingDoc._id },
      {
        $set: {
          messages: nextMessages,
          updatedAt: now,
        },
      },
    );

    return res.json({
      message: "Bulletin message added",
      data: {
        message: sanitizeBulletinMessageForClient(
          newMessage,
          authUserId,
          access,
        ),
      },
    });
  } catch (err) {
    console.error("Add bulletin message failed:", err);
    return res.status(500).json({
      error: "Failed to add bulletin message",
    });
  }
});

/* ─────────────────────────────
   PUT - Update Bulletin Message
───────────────────────────── */
router.put("/update", smallJson, async (req, res) => {
  const payloadValidation = validateBulletinUpdatePayload(req.body);

  if (!payloadValidation.isValid) {
    return res.status(400).json({
      error: payloadValidation.error,
    });
  }

  const { projectId, messageId, updates } = req.body;

  try {
    const db = getDB();
    const authUserId = new ObjectId(req.userId);
    const authUserIdString = String(authUserId);
    const projectObjectId = new ObjectId(projectId);

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
        error: "Project not found or unauthorized.",
      });
    }

    const enabledValidation = validateBulletinEnabled(project);

    if (!enabledValidation.isValid) {
      return res.status(404).json({
        error: enabledValidation.error,
      });
    }

    const updateValidation = validateBulletinMessagePayload(project, updates);

    if (!updateValidation.isValid) {
      return res.status(400).json({
        error: updateValidation.error,
      });
    }

    const safeUpdates = cleanBulletinMessagePayload(updates);

    if (!safeUpdates) {
      return res.status(400).json({
        error: "Invalid bulletin message.",
      });
    }

    const doc = await db.collection(COLLECTION_NAME).findOne({
      projectId: projectObjectId,
      type: DOC_TYPE,
    });

    if (!doc || !Array.isArray(doc.messages) || doc.messages.length === 0) {
      return res.status(404).json({
        error: "No bulletin messages found.",
      });
    }

    const messages = doc.messages;
    const messageIndex = findMessageIndex(messages, messageId);

    if (messageIndex === -1) {
      return res.status(404).json({
        error: "Bulletin message not found.",
      });
    }

    const target = messages[messageIndex];

    const canEditAny =
      access.resolvedRole === "owner" || access.resolvedRole === "admin";

    const isOwnMessage = String(target?.senderId || "") === authUserIdString;

    if (!canEditAny && !isOwnMessage) {
      return res.status(403).json({
        error: "You do not have permission to edit other people's messages.",
      });
    }

    const now = new Date();

    target.title = safeUpdates.title;
    target.body = safeUpdates.body;
    target.updatedAt = now;

    await db.collection(COLLECTION_NAME).updateOne(
      { _id: doc._id },
      {
        $set: {
          messages,
          updatedAt: now,
        },
      },
    );

    return res.json({
      message: "Bulletin message updated",
      data: {
        messageId,
        message: sanitizeBulletinMessageForClient(target, authUserId, access),
      },
    });
  } catch (err) {
    console.error("Update bulletin message failed:", err);
    return res.status(500).json({
      error: "Failed to update bulletin message",
    });
  }
});

/* ─────────────────────────────
   DELETE - Remove Bulletin Message
───────────────────────────── */
router.delete("/remove", smallJson, async (req, res) => {
  const payloadValidation = validateBulletinRemovePayload(req.body);

  if (!payloadValidation.isValid) {
    return res.status(400).json({
      error: payloadValidation.error,
    });
  }

  const { projectId, messageId } = req.body;

  try {
    const db = getDB();
    const authUserId = new ObjectId(req.userId);
    const authUserIdString = String(authUserId);
    const projectObjectId = new ObjectId(projectId);

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
        error: "Project not found or unauthorized.",
      });
    }

    const enabledValidation = validateBulletinEnabled(project);

    if (!enabledValidation.isValid) {
      return res.status(404).json({
        error: enabledValidation.error,
      });
    }

    const doc = await db.collection(COLLECTION_NAME).findOne({
      projectId: projectObjectId,
      type: DOC_TYPE,
    });

    if (!doc || !Array.isArray(doc.messages) || doc.messages.length === 0) {
      return res.status(404).json({
        error: "No bulletin messages found.",
      });
    }

    const messages = doc.messages;
    const target = messages.find((msg) => msg.id === messageId) || null;

    if (!target) {
      return res.status(404).json({
        error: "Bulletin message not found.",
      });
    }

    const canEditAny =
      access.resolvedRole === "owner" || access.resolvedRole === "admin";

    const isOwnMessage = String(target?.senderId || "") === authUserIdString;

    if (!canEditAny && !isOwnMessage) {
      return res.status(403).json({
        error: "You do not have permission to edit other people's messages.",
      });
    }

    const nextMessages = messages.filter((msg) => msg.id !== messageId);
    const now = new Date();

    await db.collection(COLLECTION_NAME).updateOne(
      { _id: doc._id },
      {
        $set: {
          messages: nextMessages,
          updatedAt: now,
        },
      },
    );

    return res.json({
      message: "Bulletin message removed",
      data: {
        deleted: true,
        messageId,
      },
    });
  } catch (err) {
    console.error("Remove bulletin message failed:", err);
    return res.status(500).json({
      error: "Failed to remove bulletin message",
    });
  }
});

export default router;