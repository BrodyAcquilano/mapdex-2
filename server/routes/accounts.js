import express from "express";
import { tinyJson } from "../middleware/bodyLimits.js";
import bcrypt from "bcrypt";
import { ObjectId } from "mongodb";

import { getDB } from "../db.js";
import { storage } from "../media/mediaService.js";
import {
  hasExactKeys,
  hasNoKeys,
  validatePassword,
  validateUserName,
} from "../../shared/auth/auth.js";
import { validateUserColorTheme } from "../../shared/validation/accounts.js";
import { sanitizeUserRefs } from "../utils/userRefs.js";
import { deleteProjectSpatialDocs } from "../utils/deleteProjectSpatialDocs.js";

const router = express.Router();

/* ─────────────────────────────
   GET - User (Authenticated User)
───────────────────────────── */
router.get("/user", async (req, res) => {
  try {
    const db = getDB();
    const users = db.collection("users");

    const user = await users.findOne(
      { _id: new ObjectId(req.userId) },
      {
        projection: {
          userName: 1,
          voicePlan: 1,
          subscriptionTier: 1,
          userColorTheme: 1,
          followers: 1,
          following: 1,
          blockedUsers: 1,
        },
      },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.json({
      success: true,
      message: "User retrieved.",
      data: {
        userName: user.userName || "",
        voicePlan: user.voicePlan || "free",
        subscriptionTier: user.subscriptionTier || "free",
        userColorTheme: user.userColorTheme || "green",
        followers: sanitizeUserRefs(user.followers),
        following: sanitizeUserRefs(user.following),
        blockedUsers: sanitizeUserRefs(user.blockedUsers),
      },
    });
  } catch (err) {
    console.error("Fetch user failed:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to load user.",
    });
  }
});

/* ─────────────────────────────
   POST - Change Username (Authenticated User)
───────────────────────────── */
router.post("/change-username", tinyJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["newUserName"])) {
    return res.status(400).json({
      success: false,
      message: "Invalid username update payload.",
    });
  }

  const { newUserName } = req.body;

  const userNameError = validateUserName(newUserName);
  if (userNameError) {
    return res.status(400).json({
      success: false,
      message: userNameError,
    });
  }

  const normalizedUserName = newUserName.trim();

  try {
    const db = getDB();
    const users = db.collection("users");
    const projects = db.collection("projects");
    const bulletin = db.collection("bulletin");
    const projectChat = db.collection("projectChat");
    const presence = db.collection("presence");

    const userId = new ObjectId(req.userId);
    const userIdString = String(userId);
    const now = new Date();

    const USERNAME_CHANGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

    const user = await users.findOne({
      _id: userId,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (
      (user.userName || "").toLowerCase() === normalizedUserName.toLowerCase()
    ) {
      return res.status(400).json({
        success: false,
        message: "New username must be different from current username.",
      });
    }

    const lastUserNameChangeAt = user.lastUserNameChangeAt
      ? new Date(user.lastUserNameChangeAt)
      : null;

    if (
      lastUserNameChangeAt &&
      Number.isFinite(lastUserNameChangeAt.getTime())
    ) {
      const elapsedMs = now.getTime() - lastUserNameChangeAt.getTime();

      if (elapsedMs < USERNAME_CHANGE_COOLDOWN_MS) {
        const remainingHours = Math.ceil(
          (USERNAME_CHANGE_COOLDOWN_MS - elapsedMs) / (60 * 60 * 1000),
        );

        return res.status(429).json({
          success: false,
          message: `You can change your username again in about ${remainingHours} hour${
            remainingHours === 1 ? "" : "s"
          }.`,
        });
      }
    }

    const existingUser = await users.findOne({
      _id: { $ne: user._id },
      $expr: {
        $eq: [{ $toLower: "$userName" }, normalizedUserName.toLowerCase()],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Username is already taken.",
      });
    }

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          userName: normalizedUserName,
          lastUserNameChangeAt: now,
          updatedAt: now,
        },
      },
    );

    await projects.updateMany(
      {
        projectOwnerId: userId,
      },
      {
        $set: {
          owner: normalizedUserName,
          updatedAt: now,
          configUpdatedAt: now,
        },
      },
    );

    await projects.updateMany(
      {
        $or: [
          { "adminRole._id": userId },
          { "editorRole._id": userId },
          { "viewerRole._id": userId },
        ],
      },
      {
        $set: {
          "adminRole.$[adminUser].userName": normalizedUserName,
          "editorRole.$[editorUser].userName": normalizedUserName,
          "viewerRole.$[viewerUser].userName": normalizedUserName,
          updatedAt: now,
          configUpdatedAt: now,
        },
      },
      {
        arrayFilters: [
          { "adminUser._id": userId },
          { "editorUser._id": userId },
          { "viewerUser._id": userId },
        ],
      },
    );

    await presence.updateMany(
      {
        createdByUserId: userId,
        type: "presence",
      },
      {
        $set: {
          userName: normalizedUserName,
          updatedAt: now,
        },
      },
    );

    await users.updateMany(
      {
        $or: [
          { "followers._id": userId },
          { "following._id": userId },
          { "blockedUsers._id": userId },
        ],
      },
      {
        $set: {
          "followers.$[follower].userName": normalizedUserName,
          "following.$[followed].userName": normalizedUserName,
          "blockedUsers.$[blocked].userName": normalizedUserName,
          updatedAt: now,
        },
      },
      {
        arrayFilters: [
          { "follower._id": userId },
          { "followed._id": userId },
          { "blocked._id": userId },
        ],
      },
    );

    await bulletin.updateMany(
      {
        type: "bulletin",
        "messages.senderId": userIdString,
      },
      {
        $set: {
          "messages.$[message].senderName": normalizedUserName,
          updatedAt: now,
        },
      },
      {
        arrayFilters: [{ "message.senderId": userIdString }],
      },
    );

    await projectChat.updateMany(
      {
        type: "projectChat",
        "messages.senderId": userIdString,
      },
      {
        $set: {
          "messages.$[message].senderName": normalizedUserName,
          updatedAt: now,
        },
      },
      {
        arrayFilters: [{ "message.senderId": userIdString }],
      },
    );

    return res.json({
      success: true,
      message: "Username updated successfully.",
    });
  } catch (err) {
    console.error("Change username failed:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update username.",
    });
  }
});

/* ─────────────────────────────
   POST - Change Password (Authenticated User)
───────────────────────────── */
router.post("/change-password", tinyJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["currentPassword", "newPassword"])) {
    return res.status(400).json({
      success: false,
      message: "Invalid password update payload.",
    });
  }

  const { currentPassword, newPassword } = req.body;

  if (typeof currentPassword !== "string") {
    return res.status(400).json({
      success: false,
      message: "Current password must be text.",
    });
  }

  if (typeof newPassword !== "string") {
    return res.status(400).json({
      success: false,
      message: "New password must be text.",
    });
  }

  try {
    const db = getDB();
    const users = db.collection("users");

    const user = await users.findOne({
      _id: new ObjectId(req.userId),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const passwordMatch = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!passwordMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    const samePassword = await bcrypt.compare(newPassword, user.passwordHash);

    if (samePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password.",
      });
    }

    const passwordError = validatePassword(newPassword, user.email);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError,
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash,
          updatedAt: new Date(),
        },
      },
    );

    return res.json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (err) {
    console.error("Change password failed:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update password.",
    });
  }
});

/* ─────────────────────────────
   POST - Change User Color Theme (Authenticated User)
───────────────────────────── */
router.post("/change-user-color-theme", tinyJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["userColorTheme"])) {
    return res.status(400).json({
      success: false,
      message: "Invalid user color theme payload.",
    });
  }

  const { userColorTheme } = req.body;

  const themeError = validateUserColorTheme(userColorTheme);
  if (themeError) {
    return res.status(400).json({
      success: false,
      message: themeError,
    });
  }

  const normalizedUserColorTheme = userColorTheme.trim();

  try {
    const db = getDB();
    const users = db.collection("users");
    const projectsCol = db.collection("projects");
    const projectChat = db.collection("projectChat");
    const presence = db.collection("presence");

    const userId = new ObjectId(req.userId);
    const userIdString = String(userId);
    const now = new Date();

    const user = await users.findOne({
      _id: userId,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if ((user.userColorTheme || "green") === normalizedUserColorTheme) {
      return res.status(400).json({
        success: false,
        message: "New color theme must be different from current color theme.",
      });
    }

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          userColorTheme: normalizedUserColorTheme,
          updatedAt: now,
        },
      },
    );

    await projectsCol.updateMany(
      { projectOwnerId: userId },
      {
        $set: {
          ownerColorTheme: normalizedUserColorTheme,
          updatedAt: now,
        },
      },
    );

    await projectsCol.updateMany(
      {
        $or: [
          { "adminRole._id": userId },
          { "editorRole._id": userId },
          { "viewerRole._id": userId },
        ],
      },
      {
        $set: {
          "adminRole.$[adminUser].userColorTheme": normalizedUserColorTheme,
          "editorRole.$[editorUser].userColorTheme": normalizedUserColorTheme,
          "viewerRole.$[viewerUser].userColorTheme": normalizedUserColorTheme,
          updatedAt: now,
        },
      },
      {
        arrayFilters: [
          { "adminUser._id": userId },
          { "editorUser._id": userId },
          { "viewerUser._id": userId },
        ],
      },
    );

    await presence.updateMany(
      {
        createdByUserId: userId,
        type: "presence",
      },
      {
        $set: {
          userColorTheme: normalizedUserColorTheme,
          updatedAt: now,
        },
      },
    );

    await projectChat.updateMany(
      {
        type: "projectChat",
        "messages.senderId": userIdString,
      },
      {
        $set: {
          "messages.$[message].userColorTheme": normalizedUserColorTheme,
          updatedAt: now,
        },
      },
      {
        arrayFilters: [{ "message.senderId": userIdString }],
      },
    );

    await users.updateMany(
      {
        $or: [
          { "followers._id": userId },
          { "following._id": userId },
          { "blockedUsers._id": userId },
        ],
      },
      {
        $set: {
          "followers.$[follower].userColorTheme": normalizedUserColorTheme,
          "following.$[followed].userColorTheme": normalizedUserColorTheme,
          "blockedUsers.$[blocked].userColorTheme": normalizedUserColorTheme,
          updatedAt: now,
        },
      },
      {
        arrayFilters: [
          { "follower._id": userId },
          { "followed._id": userId },
          { "blocked._id": userId },
        ],
      },
    );

    return res.json({
      success: true,
      message: "User color theme updated successfully.",
      data: {
        userColorTheme: normalizedUserColorTheme,
      },
    });
  } catch (err) {
    console.error("Change user color theme failed:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update user color theme.",
    });
  }
});

/* ─────────────────────────────
   DELETE - Delete Account (Full Cascade Hard delete/purge all account records)
───────────────────────────── */
router.delete("/delete-account", tinyJson, async (req, res) => {
  if (!hasNoKeys(req.body)) {
    return res.status(400).json({
      success: false,
      message: "Invalid delete account payload.",
    });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);

    const users = db.collection("users");
    const projectsCol = db.collection("projects");
    const projectChatCol = db.collection("projectChat");
    const bulletinCol = db.collection("bulletin");

    const user = await users.findOne({ _id: userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    await projectsCol.updateMany(
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
          updatedAt: new Date(),
        },
      },
    );

    await users.updateMany(
      {
        $or: [
          { "followers._id": userId },
          { "following._id": userId },
          { "blockedUsers._id": userId },
        ],
      },
      {
        $pull: {
          followers: { _id: userId },
          following: { _id: userId },
          blockedUsers: { _id: userId },
        },
        $set: {
          updatedAt: new Date(),
        },
      },
    );

    const projects = await projectsCol
      .find({ projectOwnerId: userId })
      .toArray();

    for (const project of projects) {
      const projectId = project._id;
      const collectionName = project.engineKey;

      const engineCollection = db.collection(collectionName);

      const images = await engineCollection
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

      await engineCollection.deleteMany({
        projectOwnerId: userId,
        projectId,
      });

      await projectChatCol.deleteMany({
        projectId,
        type: "projectChat",
      });

      await bulletinCol.deleteMany({
        projectId,
        type: "bulletin",
      });

      /*
       * Boundaries, layers and aggregates, which live in their own
       * collections rather than in the engine collection emptied above -
       * after the data and extension documents, before the projects
       * themselves are removed below.
       */
      await deleteProjectSpatialDocs(db, projectId);
    }

    await projectsCol.deleteMany({ projectOwnerId: userId });

    const deletedProjectIds = projects.map((project) => project._id);

    if (deletedProjectIds.length > 0) {
      await users.updateMany(
        { "favouriteProjects._id": { $in: deletedProjectIds } },
        { $pull: { favouriteProjects: { _id: { $in: deletedProjectIds } } } },
      );
    }

    await users.deleteOne({ _id: userId });

    const isProduction = process.env.NODE_ENV === "production";

    res.clearCookie("token", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
    });

    return res.json({
      success: true,
      message: "Account deleted successfully.",
    });
  } catch (err) {
    console.error("Account deletion failed:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete account.",
    });
  }
});

/* ─────────────────────────────
   POST - Soft Delete Account
───────────────────────────── */
router.post("/deactivate", tinyJson, async (req, res) => {
  if (!hasNoKeys(req.body)) {
    return res.status(400).json({
      success: false,
      message: "Invalid deactivate account payload.",
    });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);

    const result = await db.collection("users").updateOne(
      { _id: userId },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
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
      message: "Account deactivated.",
    });
  } catch (err) {
    console.error("Deactivate failed:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to deactivate account.",
    });
  }
});

/* ─────────────────────────────
   POST - Restore Account
───────────────────────────── */
router.post("/restore", tinyJson, async (req, res) => {
  if (!hasNoKeys(req.body)) {
    return res.status(400).json({
      success: false,
      message: "Invalid restore account payload.",
    });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);

    const result = await db.collection("users").updateOne(
      { _id: userId },
      {
        $set: {
          isDeleted: false,
          deletedAt: null,
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
      message: "Account restored.",
    });
  } catch (err) {
    console.error("Restore failed:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to restore account.",
    });
  }
});

export default router;
