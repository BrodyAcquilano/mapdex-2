import express from "express";
import { smallJson } from "../middleware/bodyLimits.js";
import { ObjectId } from "mongodb";
import { nanoid } from "nanoid";
import { getDB } from "../db.js";
import { hasProjectAccess } from "../utils/projectPermissions.js";

import {
  cleanProjectChatMessagePayload,
  getProjectChatConfig,
  validateProjectChatAddPayload,
  validateProjectChatEnabled,
  validateProjectChatGetPayload,
  validateProjectChatMessagePayload,
} from "../../shared/validation/projectChatContentValidation.js";

const router = express.Router();

const COLLECTION_NAME = "projectChat";
const DOC_TYPE = "projectChat";

/* ─────────────────────────────
   Helpers
───────────────────────────── */

function sanitizeChatMessageForClient(message) {
  const safeMessage = {
    ...message,
  };

  delete safeMessage.senderId;

  return safeMessage;
}

function sanitizeChatMessagesForClient(messages) {
  return Array.isArray(messages)
    ? messages.map(sanitizeChatMessageForClient)
    : [];
}

/* ─────────────────────────────
   POST - Get Project Chat
───────────────────────────── */
router.post("/get", smallJson, async (req, res) => {
  const payloadValidation = validateProjectChatGetPayload(req.body);

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

    const enabledValidation = validateProjectChatEnabled(project);

    if (!enabledValidation.isValid) {
      return res.status(404).json({
        error: enabledValidation.error,
      });
    }

    const chatConfig = getProjectChatConfig(project);

    const doc = await db.collection(COLLECTION_NAME).findOne({
      projectId: projectObjectId,
      type: DOC_TYPE,
    });

    if (!doc || !Array.isArray(doc.messages) || doc.messages.length === 0) {
      return res.json({
        message: "No project chat messages found",
        data: {
          messages: [],
          maxMessages: chatConfig.maxMessages,
          messageLength: chatConfig.messageLength,
        },
      });
    }

    return res.json({
      message: "Project chat messages retrieved",
      data: {
        messages: sanitizeChatMessagesForClient(doc.messages),
        maxMessages: chatConfig.maxMessages,
        messageLength: chatConfig.messageLength,
      },
    });
  } catch (err) {
    console.error("Project chat fetch failed:", err);
    return res.status(500).json({
      error: "Failed to fetch project chat",
    });
  }
});

/* ─────────────────────────────
   POST - Add Chat Message
───────────────────────────── */
router.post("/add", smallJson, async (req, res) => {
  const payloadValidation = validateProjectChatAddPayload(req.body);

  if (!payloadValidation.isValid) {
    return res.status(400).json({
      error: payloadValidation.error,
    });
  }

  const { projectId, chatMessage } = req.body;

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

    const access = hasProjectAccess(project, authUserId, "viewer");

    if (!access.hasAccess) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const enabledValidation = validateProjectChatEnabled(project);

    if (!enabledValidation.isValid) {
      return res.status(404).json({
        error: enabledValidation.error,
      });
    }

    const messageValidation = validateProjectChatMessagePayload(
      project,
      chatMessage,
    );

    if (!messageValidation.isValid) {
      return res.status(400).json({
        error: messageValidation.error,
      });
    }

    const safeChatMessage = cleanProjectChatMessagePayload(chatMessage);

    if (!safeChatMessage) {
      return res.status(400).json({
        error: "Invalid chat message.",
      });
    }

    const chatConfig = getProjectChatConfig(project);

    const user = await db.collection("users").findOne(
      { _id: authUserId },
      {
        projection: {
          userName: 1,
          userColorTheme: 1,
        },
      },
    );

    const newMessage = {
      id: nanoid(),
      senderId: authUserIdString,
      senderName: user?.userName || req.userName || "Unknown",
      userColorTheme: user?.userColorTheme || "green",
      message: safeChatMessage.message,
      createdAt: now,
      updatedAt: now,
    };

    const existingDoc = await db.collection(COLLECTION_NAME).findOne({
      projectId: projectObjectId,
      type: DOC_TYPE,
    });

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

      const safeMessages = sanitizeChatMessagesForClient([newMessage]);

      return res.status(201).json({
        message: "Project chat message added",
        data: {
          message: safeMessages[0],
          messages: safeMessages,
        },
      });
    }

    const nextMessages = [
      ...(Array.isArray(existingDoc.messages) ? existingDoc.messages : []),
      newMessage,
    ].slice(-chatConfig.maxMessages);

    await db.collection(COLLECTION_NAME).updateOne(
      { _id: existingDoc._id },
      {
        $set: {
          messages: nextMessages,
          updatedAt: now,
        },
      },
    );

    const safeNextMessages = sanitizeChatMessagesForClient(nextMessages);

    return res.json({
      message: "Project chat message added",
      data: {
        message: safeNextMessages[safeNextMessages.length - 1],
        messages: safeNextMessages,
      },
    });
  } catch (err) {
    console.error("Add project chat message failed:", err);
    return res.status(500).json({
      error: "Failed to add project chat message",
    });
  }
});

export default router;