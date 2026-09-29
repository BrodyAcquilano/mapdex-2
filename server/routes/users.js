import express from "express";
import { tinyJson } from "../middleware/bodyLimits.js";
import { ObjectId } from "mongodb";

import { getDB } from "../db.js";
import { hasExactKeys, validateUserName } from "../../shared/auth/auth.js";
import { validateFavouriteProjectPayload } from "../../shared/validation/projectValidation.js";
import {
  USER_FAVOURITE_LIMITS,
  USER_RELATIONSHIP_LIMITS,
  USER_SEARCH_LIMITS,
} from "../../shared/validation/userConstants.js";
import { hasProjectAccess } from "../utils/projectPermissions.js";
import { getBlockedRelationshipIds } from "../utils/blockedUsers.js";
import { sanitizeUserRefs } from "../utils/userRefs.js";

const router = express.Router();

/* ─────────────────────────────
   Helper: Resolve a target user by username (case-insensitive).
   Excludes deleted accounts. Never trusts client-provided ids.
───────────────────────────── */
async function resolveTargetUserByUserName(db, userName) {
  const target = await db.collection("users").findOne(
    {
      isDeleted: { $ne: true },
      $expr: {
        $eq: [{ $toLower: "$userName" }, String(userName).toLowerCase()],
      },
    },
    {
      projection: {
        userName: 1,
        userColorTheme: 1,
        followers: 1,
        following: 1,
        blockedUsers: 1,
        favouriteProjects: 1,
      },
    },
  );

  return target || null;
}

function isBlockedEitherWay(myUser, targetUser) {
  const myId = String(myUser._id);
  const targetId = String(targetUser._id);

  const targetBlockedMe = (targetUser.blockedUsers || []).some(
    (ref) => String(ref?._id) === myId,
  );

  const iBlockedTarget = (myUser.blockedUsers || []).some(
    (ref) => String(ref?._id) === targetId,
  );

  return targetBlockedMe || iBlockedTarget;
}

function validateFollowActionPayload(payload) {
  if (!hasExactKeys(payload, ["userName"])) return false;
  return typeof payload.userName === "string" && payload.userName.trim() !== "";
}

const FAVOURITE_PROJECT_PROJECTION = {
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
  createdAt: 1,
  updatedAt: 1,
  configUpdatedAt: 1,
};

/* ─────────────────────────────
   Helper: Resolve favourited project refs into safe, access-checked
   project objects, sorted by when each was favourited (most recent first).
   Anyone who lost access since favoriting (a project going private, a
   revoked role, a new block) is silently dropped rather than shown.
───────────────────────────── */
async function resolveFavouriteProjects(db, favouriteRefs, viewerId, excludedOwnerIds) {
  const favouriteIds = (favouriteRefs || []).map((ref) => ref?._id).filter(Boolean);
  if (favouriteIds.length === 0) return [];

  const addedAtByProjectId = new Map(
    (favouriteRefs || []).map((ref) => [String(ref._id), ref.addedAt]),
  );

  const projects = await db
    .collection("projects")
    .find(
      {
        _id: { $in: favouriteIds },
        projectOwnerId: { $nin: excludedOwnerIds },
      },
      { projection: FAVOURITE_PROJECT_PROJECTION },
    )
    .toArray();

  const safeProjects = [];

  for (const project of projects) {
    const access = hasProjectAccess(project, viewerId, "viewer");
    if (!access.hasAccess) continue;

    const canViewSensitiveRoles =
      access.resolvedRole === "owner" || access.resolvedRole === "admin";

    const safeProject = { ...project, userRole: access.resolvedRole || "viewer" };
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

    safeProjects.push(safeProject);
  }

  safeProjects.sort((a, b) => {
    const aAddedAt = new Date(addedAtByProjectId.get(String(a._id)) || 0);
    const bAddedAt = new Date(addedAtByProjectId.get(String(b._id)) || 0);
    return bAddedAt - aAddedAt;
  });

  return safeProjects;
}

/* ─────────────────────────────
   GET - Search Users
───────────────────────────── */
router.get("/search", async (req, res) => {
  try {
    const db = getDB();
    const myId = new ObjectId(req.userId);

    const me = await db
      .collection("users")
      .findOne({ _id: myId }, { projection: { blockedUsers: 1 } });

    if (!me) {
      return res.status(401).json({ error: "Invalid user session." });
    }

    const myBlockedIds = (me.blockedUsers || [])
      .map((ref) => ref?._id)
      .filter(Boolean);

    const rawTerm = String(req.query.username || "")
      .trim()
      .slice(0, USER_SEARCH_LIMITS.usernameSearchMaxLength);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = USER_SEARCH_LIMITS.pageSize;

    const query = {
      _id: { $ne: myId, $nin: myBlockedIds },
      isDeleted: { $ne: true },
      "blockedUsers._id": { $ne: myId },
    };

    if (rawTerm) {
      const escapedTerm = rawTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.userName = { $regex: escapedTerm, $options: "i" };
    }

    const usersCollection = db.collection("users");

    const [total, matches] = await Promise.all([
      usersCollection.countDocuments(query),
      usersCollection
        .find(query, { projection: { userName: 1, userColorTheme: 1 } })
        .sort({ userName: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
    ]);

    return res.json({
      message: "Users retrieved",
      data: {
        users: matches.map((u) => ({
          userName: u.userName || "",
          userColorTheme: u.userColorTheme || "green",
        })),
        total,
        page,
        pageSize,
      },
    });
  } catch (err) {
    console.error("Search users failed:", err);
    return res.status(500).json({ error: "Failed to search users." });
  }
});

/* ─────────────────────────────
   GET - User Profile (by username)
───────────────────────────── */
router.get("/profile/:userName", async (req, res) => {
  try {
    const db = getDB();
    const myId = new ObjectId(req.userId);

    const me = await db
      .collection("users")
      .findOne({ _id: myId }, { projection: { blockedUsers: 1 } });

    if (!me) {
      return res.status(401).json({ error: "Invalid user session." });
    }

    const target = await resolveTargetUserByUserName(db, req.params.userName);

    if (!target || isBlockedEitherWay(me, target)) {
      return res.status(404).json({ error: "User not found." });
    }

    const targetIdString = String(target._id);
    const myIdString = String(myId);

    const isFollowedByMe = (target.followers || []).some(
      (ref) => String(ref?._id) === myIdString,
    );

    const isFollowingMe = (target.following || []).some(
      (ref) => String(ref?._id) === myIdString,
    );

    return res.json({
      message: "User profile retrieved",
      data: {
        userName: target.userName || "",
        userColorTheme: target.userColorTheme || "green",
        followers: sanitizeUserRefs(target.followers),
        following: sanitizeUserRefs(target.following),
        isFollowedByMe,
        isFollowingMe,
        isSelf: targetIdString === myIdString,
      },
    });
  } catch (err) {
    console.error("Fetch user profile failed:", err);
    return res.status(500).json({ error: "Failed to fetch user profile." });
  }
});

/* ─────────────────────────────
   GET - Projects Visible To Me For A Given User
───────────────────────────── */
router.get("/profile/:userName/projects", async (req, res) => {
  try {
    const db = getDB();
    const myId = new ObjectId(req.userId);

    const me = await db
      .collection("users")
      .findOne({ _id: myId }, { projection: { blockedUsers: 1 } });

    if (!me) {
      return res.status(401).json({ error: "Invalid user session." });
    }

    const target = await resolveTargetUserByUserName(db, req.params.userName);

    if (!target || isBlockedEitherWay(me, target)) {
      return res.status(404).json({ error: "User not found." });
    }

    const projects = await db
      .collection("projects")
      .find(
        {
          projectOwnerId: target._id,
          $or: [
            { visibility: { $in: ["public", "open"] } },
            { "adminRole._id": myId },
            { "editorRole._id": myId },
            { "viewerRole._id": myId },
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
            projectOwnerId: 1,
            adminRole: 1,
            editorRole: 1,
            viewerRole: 1,
            createdAt: 1,
            updatedAt: 1,
            configUpdatedAt: 1,
          },
        },
      )
      .toArray();

    const safeProjects = projects.map((project) => {
      const access = hasProjectAccess(project, myId, "viewer");
      const canViewSensitiveRoles =
        access.resolvedRole === "owner" || access.resolvedRole === "admin";

      // Whether I was explicitly given a role on this project, independent
      // of its visibility — a public/open project I'm an admin/editor/viewer
      // on is still "shared with me" alongside also being public/open.
      const isSharedWithMe = [
        ...(project.adminRole || []),
        ...(project.editorRole || []),
        ...(project.viewerRole || []),
      ].some((ref) => String(ref?._id) === String(myId));

      const safeProject = {
        ...project,
        userRole: access.resolvedRole || "viewer",
        isSharedWithMe,
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

    const isOpenOrPublic = (p) => p.visibility === "public" || p.visibility === "open";
    safeProjects.sort((a, b) => {
      const visibilityDiff = Number(isOpenOrPublic(b)) - Number(isOpenOrPublic(a));
      if (visibilityDiff !== 0) return visibilityDiff;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    return res.json({
      message: "User projects retrieved",
      data: safeProjects,
    });
  } catch (err) {
    console.error("Fetch user projects failed:", err);
    return res.status(500).json({ error: "Failed to fetch user projects." });
  }
});

/* ─────────────────────────────
   GET - My Favourite Projects
───────────────────────────── */
router.get("/favourites", async (req, res) => {
  try {
    const db = getDB();
    const myId = new ObjectId(req.userId);

    const me = await db
      .collection("users")
      .findOne({ _id: myId }, { projection: { favouriteProjects: 1 } });

    if (!me) {
      return res.status(401).json({ error: "Invalid user session." });
    }

    const excludedOwnerIds = await getBlockedRelationshipIds(db, myId);
    const safeProjects = await resolveFavouriteProjects(
      db,
      me.favouriteProjects,
      myId,
      excludedOwnerIds,
    );

    return res.json({
      message: "Favourite projects retrieved",
      data: safeProjects,
    });
  } catch (err) {
    console.error("Fetch favourite projects failed:", err);
    return res.status(500).json({ error: "Failed to fetch favourite projects." });
  }
});

/* ─────────────────────────────
   GET - Another User's Favourite Projects (filtered to what I can also see)
───────────────────────────── */
router.get("/profile/:userName/favourites", async (req, res) => {
  try {
    const db = getDB();
    const myId = new ObjectId(req.userId);

    const me = await db
      .collection("users")
      .findOne({ _id: myId }, { projection: { blockedUsers: 1 } });

    if (!me) {
      return res.status(401).json({ error: "Invalid user session." });
    }

    const target = await resolveTargetUserByUserName(db, req.params.userName);

    if (!target || isBlockedEitherWay(me, target)) {
      return res.status(404).json({ error: "User not found." });
    }

    const excludedOwnerIds = await getBlockedRelationshipIds(db, myId);
    const safeProjects = await resolveFavouriteProjects(
      db,
      target.favouriteProjects,
      myId,
      excludedOwnerIds,
    );

    return res.json({
      message: "User favourite projects retrieved",
      data: safeProjects,
    });
  } catch (err) {
    console.error("Fetch user favourite projects failed:", err);
    return res.status(500).json({ error: "Failed to fetch user favourite projects." });
  }
});

/* ─────────────────────────────
   POST - Add Favourite Project
───────────────────────────── */
router.post("/favourites/add", tinyJson, async (req, res) => {
  if (!validateFavouriteProjectPayload(req.body)) {
    return res.status(400).json({ error: "Invalid favourite project payload." });
  }

  try {
    const db = getDB();
    const myId = new ObjectId(req.userId);
    const projectId = new ObjectId(req.body.projectId);

    const me = await db
      .collection("users")
      .findOne({ _id: myId }, { projection: { favouriteProjects: 1 } });

    if (!me) {
      return res.status(401).json({ error: "Invalid user session." });
    }

    const project = await db.collection("projects").findOne({ _id: projectId });

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    // Require actual viewer-or-better access so a project can't be favourited
    // just by guessing/sending an arbitrary id.
    const access = hasProjectAccess(project, myId, "viewer");

    if (!access.hasAccess) {
      return res.status(404).json({ error: "Project not found." });
    }

    const alreadyFavourited = (me.favouriteProjects || []).some(
      (ref) => String(ref?._id) === String(projectId),
    );

    if (alreadyFavourited) {
      return res.status(400).json({ error: "Project is already in your favourites." });
    }

    if (
      (me.favouriteProjects || []).length >= USER_FAVOURITE_LIMITS.maxFavouriteProjects
    ) {
      return res.status(400).json({
        error: `You can favourite at most ${USER_FAVOURITE_LIMITS.maxFavouriteProjects} projects.`,
      });
    }

    const now = new Date();

    await db.collection("users").updateOne(
      { _id: myId },
      {
        $addToSet: { favouriteProjects: { _id: projectId, addedAt: now } },
        $set: { updatedAt: now },
      },
    );

    return res.json({
      message: "Project favourited",
      data: { _id: projectId.toString() },
    });
  } catch (err) {
    console.error("Add favourite project failed:", err);
    return res.status(500).json({ error: "Failed to favourite project." });
  }
});

/* ─────────────────────────────
   POST - Remove Favourite Project
───────────────────────────── */
router.post("/favourites/remove", tinyJson, async (req, res) => {
  if (!validateFavouriteProjectPayload(req.body)) {
    return res.status(400).json({ error: "Invalid favourite project payload." });
  }

  try {
    const db = getDB();
    const myId = new ObjectId(req.userId);
    const projectId = new ObjectId(req.body.projectId);

    await db.collection("users").updateOne(
      { _id: myId },
      {
        $pull: { favouriteProjects: { _id: projectId } },
        $set: { updatedAt: new Date() },
      },
    );

    return res.json({ message: "Project removed from favourites" });
  } catch (err) {
    console.error("Remove favourite project failed:", err);
    return res.status(500).json({ error: "Failed to remove favourite project." });
  }
});

/* ─────────────────────────────
   POST - Follow User
───────────────────────────── */
router.post("/follow", tinyJson, async (req, res) => {
  if (!validateFollowActionPayload(req.body)) {
    return res.status(400).json({ error: "Invalid follow payload." });
  }

  const userNameError = validateUserName(req.body.userName);
  if (userNameError) {
    return res.status(400).json({ error: userNameError });
  }

  try {
    const db = getDB();
    const users = db.collection("users");
    const myId = new ObjectId(req.userId);

    const me = await users.findOne(
      { _id: myId },
      {
        projection: {
          userName: 1,
          userColorTheme: 1,
          blockedUsers: 1,
          following: 1,
        },
      },
    );

    if (!me) {
      return res.status(401).json({ error: "Invalid user session." });
    }

    const target = await resolveTargetUserByUserName(db, req.body.userName);

    if (!target) {
      return res.status(404).json({ error: "User not found." });
    }

    if (String(target._id) === String(myId)) {
      return res.status(400).json({ error: "You cannot follow yourself." });
    }

    if (isBlockedEitherWay(me, target)) {
      return res.status(403).json({ error: "Unable to follow this user." });
    }

    const alreadyFollowing = (target.followers || []).some(
      (ref) => String(ref?._id) === String(myId),
    );

    if (alreadyFollowing) {
      return res.status(400).json({ error: "Already following this user." });
    }

    if (
      (me.following || []).length >= USER_RELATIONSHIP_LIMITS.maxFollowing
    ) {
      return res.status(400).json({
        error: `You can follow at most ${USER_RELATIONSHIP_LIMITS.maxFollowing} users.`,
      });
    }

    const now = new Date();

    await users.updateOne(
      { _id: myId },
      {
        $addToSet: {
          following: {
            _id: target._id,
            userName: target.userName,
            userColorTheme: target.userColorTheme || "green",
          },
        },
        $set: { updatedAt: now },
      },
    );

    await users.updateOne(
      { _id: target._id },
      {
        $addToSet: {
          followers: {
            _id: myId,
            userName: me.userName,
            userColorTheme: me.userColorTheme || "green",
          },
        },
        $set: { updatedAt: now },
      },
    );

    return res.json({
      message: "User followed",
      data: {
        userName: target.userName,
        userColorTheme: target.userColorTheme || "green",
      },
    });
  } catch (err) {
    console.error("Follow user failed:", err);
    return res.status(500).json({ error: "Failed to follow user." });
  }
});

/* ─────────────────────────────
   POST - Unfollow User
───────────────────────────── */
router.post("/unfollow", tinyJson, async (req, res) => {
  if (!validateFollowActionPayload(req.body)) {
    return res.status(400).json({ error: "Invalid unfollow payload." });
  }

  try {
    const db = getDB();
    const users = db.collection("users");
    const myId = new ObjectId(req.userId);
    const now = new Date();

    const target = await resolveTargetUserByUserName(db, req.body.userName);

    if (target) {
      await users.updateOne(
        { _id: target._id },
        { $pull: { followers: { _id: myId } }, $set: { updatedAt: now } },
      );
    }

    const normalizedUserName = String(req.body.userName).trim().toLowerCase();

    await users.updateOne(
      { _id: myId },
      {
        $pull: target
          ? { following: { _id: target._id } }
          : {
              following: {
                userName: { $regex: `^${normalizedUserName}$`, $options: "i" },
              },
            },
        $set: { updatedAt: now },
      },
    );

    return res.json({ message: "User unfollowed" });
  } catch (err) {
    console.error("Unfollow user failed:", err);
    return res.status(500).json({ error: "Failed to unfollow user." });
  }
});

/* ─────────────────────────────
   POST - Remove Follower
───────────────────────────── */
router.post("/remove-follower", tinyJson, async (req, res) => {
  if (!validateFollowActionPayload(req.body)) {
    return res.status(400).json({ error: "Invalid remove follower payload." });
  }

  try {
    const db = getDB();
    const users = db.collection("users");
    const myId = new ObjectId(req.userId);
    const now = new Date();

    const target = await resolveTargetUserByUserName(db, req.body.userName);

    if (target) {
      await users.updateOne(
        { _id: target._id },
        { $pull: { following: { _id: myId } }, $set: { updatedAt: now } },
      );
    }

    const normalizedUserName = String(req.body.userName).trim().toLowerCase();

    await users.updateOne(
      { _id: myId },
      {
        $pull: target
          ? { followers: { _id: target._id } }
          : {
              followers: {
                userName: { $regex: `^${normalizedUserName}$`, $options: "i" },
              },
            },
        $set: { updatedAt: now },
      },
    );

    return res.json({ message: "Follower removed" });
  } catch (err) {
    console.error("Remove follower failed:", err);
    return res.status(500).json({ error: "Failed to remove follower." });
  }
});

/* ─────────────────────────────
   POST - Block User
───────────────────────────── */
router.post("/block", tinyJson, async (req, res) => {
  if (!validateFollowActionPayload(req.body)) {
    return res.status(400).json({ error: "Invalid block payload." });
  }

  const userNameError = validateUserName(req.body.userName);
  if (userNameError) {
    return res.status(400).json({ error: userNameError });
  }

  try {
    const db = getDB();
    const users = db.collection("users");
    const myId = new ObjectId(req.userId);

    const target = await resolveTargetUserByUserName(db, req.body.userName);

    if (!target) {
      return res.status(404).json({ error: "User not found." });
    }

    if (String(target._id) === String(myId)) {
      return res.status(400).json({ error: "You cannot block yourself." });
    }

    const now = new Date();

    await users.updateOne(
      { _id: myId },
      {
        $addToSet: {
          blockedUsers: {
            _id: target._id,
            userName: target.userName,
            userColorTheme: target.userColorTheme || "green",
          },
        },
        $pull: {
          following: { _id: target._id },
          followers: { _id: target._id },
        },
        $set: { updatedAt: now },
      },
    );

    await users.updateOne(
      { _id: target._id },
      {
        $pull: {
          following: { _id: myId },
          followers: { _id: myId },
        },
        $set: { updatedAt: now },
      },
    );

    const projects = db.collection("projects");

    // Remove the blocked user's roles from my own projects, leaving any
    // data they already added untouched.
    await projects.updateMany(
      { projectOwnerId: myId },
      {
        $pull: {
          adminRole: { _id: target._id },
          editorRole: { _id: target._id },
          viewerRole: { _id: target._id },
        },
        $set: { updatedAt: now },
      },
    );

    // Remove my own roles from the blocked user's projects, so their
    // projects also disappear from my shared projects list.
    await projects.updateMany(
      { projectOwnerId: target._id },
      {
        $pull: {
          adminRole: { _id: myId },
          editorRole: { _id: myId },
          viewerRole: { _id: myId },
        },
        $set: { updatedAt: now },
      },
    );

    const [myProjectIds, targetProjectIds] = await Promise.all([
      projects
        .find({ projectOwnerId: myId }, { projection: { _id: 1 } })
        .toArray()
        .then((docs) => docs.map((doc) => doc._id)),
      projects
        .find({ projectOwnerId: target._id }, { projection: { _id: 1 } })
        .toArray()
        .then((docs) => docs.map((doc) => doc._id)),
    ]);

    // Remove my projects from their favourites, and their projects from mine.
    if (myProjectIds.length > 0) {
      await users.updateOne(
        { _id: target._id },
        { $pull: { favouriteProjects: { _id: { $in: myProjectIds } } } },
      );
    }

    if (targetProjectIds.length > 0) {
      await users.updateOne(
        { _id: myId },
        { $pull: { favouriteProjects: { _id: { $in: targetProjectIds } } } },
      );
    }

    return res.json({ message: "User blocked" });
  } catch (err) {
    console.error("Block user failed:", err);
    return res.status(500).json({ error: "Failed to block user." });
  }
});

/* ─────────────────────────────
   POST - Unblock User
───────────────────────────── */
router.post("/unblock", tinyJson, async (req, res) => {
  if (!validateFollowActionPayload(req.body)) {
    return res.status(400).json({ error: "Invalid unblock payload." });
  }

  try {
    const db = getDB();
    const users = db.collection("users");
    const myId = new ObjectId(req.userId);
    const now = new Date();

    const target = await resolveTargetUserByUserName(db, req.body.userName);
    const normalizedUserName = String(req.body.userName).trim().toLowerCase();

    await users.updateOne(
      { _id: myId },
      {
        $pull: target
          ? { blockedUsers: { _id: target._id } }
          : {
              blockedUsers: {
                userName: { $regex: `^${normalizedUserName}$`, $options: "i" },
              },
            },
        $set: { updatedAt: now },
      },
    );

    return res.json({ message: "User unblocked" });
  } catch (err) {
    console.error("Unblock user failed:", err);
    return res.status(500).json({ error: "Failed to unblock user." });
  }
});

export default router;
