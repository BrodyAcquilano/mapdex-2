import express from "express";
import { smallJson } from "../middleware/bodyLimits.js";
import { ObjectId } from "mongodb";
import { nanoid } from "nanoid";
import { getDB } from "../db.js";
import { hasProjectAccess } from "../utils/projectPermissions.js";

import {
  validateGuestbookAddEntryPayload,
  validateGuestbookDataItemIdParam,
  validateGuestbookEnabled,
  validateGuestbookEntryIdParam,
  validateGuestbookGetPayload,
  validateGuestbookRemoveAllPayload,
  validateGuestbookSigningEligibility,
  validateGuestbookToggleEntriesPayload,
  validateGuestbookUpdateEntryPayload,
} from "../../shared/validation/guestbookContentValidation.js";

const router = express.Router();
const PAGE_SIZE = 10;

/* ─────────────────────────────
   Helpers
───────────────────────────── */

function findEntryLocation(pages, entryId) {
  for (let p = 0; p < pages.length; p++) {
    const idx = pages[p].entries.findIndex((e) => e.id === entryId);
    if (idx !== -1) return { pageIndex: p, entryIndex: idx };
  }

  return null;
}

function getDataItemType(engineKey) {
  const typeByEngineKey = {
    places: "place",
    events: "event",
  };

  return typeByEngineKey[engineKey] || "";
}

function getGuestbookEntryCount(doc) {
  const pages = Array.isArray(doc?.pages) ? doc.pages : [];

  return pages.reduce((count, page) => {
    const entries = Array.isArray(page?.entries) ? page.entries : [];
    return count + entries.length;
  }, 0);
}

function sanitizeGuestbookForClient(doc) {
  return {
    pages: Array.isArray(doc?.pages) ? doc.pages : [],
    pageSize: doc?.pageSize || PAGE_SIZE,
  };
}

async function getParentDataItem({
  db,
  engineKey,
  projectObjectId,
  dataItemObjectId,
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

  return {
    dataItem,
    status: 200,
    error: null,
  };
}

async function getAuthorizedParentDataItem({
  db,
  engineKey,
  projectObjectId,
  dataItemObjectId,
  userId,
  access,
}) {
  const parentCheck = await getParentDataItem({
    db,
    engineKey,
    projectObjectId,
    dataItemObjectId,
  });

  if (!parentCheck.dataItem) {
    return parentCheck;
  }

  const canEditAny = access.isAdmin;

  const isCreatedByUser =
    String(parentCheck.dataItem.createdByUserId || "") === String(userId);

  if (!canEditAny && !isCreatedByUser) {
    return {
      dataItem: null,
      status: 403,
      error: "Editors can only manage guestbooks for data they created.",
    };
  }

  return parentCheck;
}

/* ─────────────────────────────
   POST - Get Guestbook
───────────────────────────── */
router.post("/get/:dataItemId", smallJson, async (req, res) => {
  const { dataItemId } = req.params;

  const paramValidation = validateGuestbookDataItemIdParam(dataItemId);

  if (!paramValidation.isValid) {
    return res.status(400).json({
      error: paramValidation.error,
    });
  }

  const payloadValidation = validateGuestbookGetPayload(req.body);

  if (!payloadValidation.isValid) {
    return res.status(400).json({
      error: payloadValidation.error,
    });
  }

  const { projectId, engineKey } = req.body;

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

    const parentCheck = await getParentDataItem({
      db,
      engineKey,
      projectObjectId,
      dataItemObjectId,
    });

    if (!parentCheck.dataItem) {
      return res.status(parentCheck.status).json({
        error: parentCheck.error,
      });
    }

    const enabledValidation = validateGuestbookEnabled({
      schema: project,
      dataItem: parentCheck.dataItem,
    });

    if (!enabledValidation.isValid) {
      return res.status(400).json({
        error: enabledValidation.error,
      });
    }

    const doc = await db.collection(engineKey).findOne({
      projectId: projectObjectId,
      dataItemId: dataItemObjectId,
      type: "guestbook",
    });

    if (!doc || getGuestbookEntryCount(doc) === 0) {
      return res.json({
        message: "No guestbook entries found",
        data: {
          pages: [],
          pageSize: PAGE_SIZE,
        },
      });
    }

    return res.json({
      message: "Guestbook entries retrieved",
      data: sanitizeGuestbookForClient(doc),
    });
  } catch (err) {
    console.error("Guestbook fetch failed:", err);
    return res.status(500).json({
      error: "Failed to fetch guestbook",
    });
  }
});

/* ─────────────────────────────
   POST - Add Entry
───────────────────────────── */
router.post("/add-entry/:dataItemId", smallJson, async (req, res) => {
  const { dataItemId } = req.params;

  const paramValidation = validateGuestbookDataItemIdParam(dataItemId);

  if (!paramValidation.isValid) {
    return res.status(400).json({
      error: paramValidation.error,
    });
  }

  const payloadValidation = validateGuestbookAddEntryPayload(req.body);

  if (!payloadValidation.isValid) {
    return res.status(400).json({
      error: payloadValidation.error,
    });
  }

  const { projectId, engineKey, entry } = req.body;

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const now = new Date();
    const dataItemObjectId = new ObjectId(dataItemId);
    const projectObjectId = new ObjectId(projectId);

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

    const parentCheck = await getParentDataItem({
      db,
      engineKey,
      projectObjectId,
      dataItemObjectId,
    });

    if (!parentCheck.dataItem) {
      return res.status(parentCheck.status).json({
        error: parentCheck.error,
      });
    }

    const enabledValidation = validateGuestbookEnabled({
      schema: project,
      dataItem: parentCheck.dataItem,
    });

    if (!enabledValidation.isValid) {
      return res.status(400).json({
        error: enabledValidation.error,
      });
    }

    const signingValidation = validateGuestbookSigningEligibility({
      dataItem: parentCheck.dataItem,
      lat: entry.lat,
      lng: entry.lng,
    });

    if (!signingValidation.isValid) {
      return res.status(400).json({
        error: signingValidation.error,
      });
    }

    const newEntry = {
      id: nanoid(),
      name: entry.name.trim(),
      comment: entry.comment.trim(),
      lat: Number(entry.lat),
      lng: Number(entry.lng),
      status: "visible",
      createdAt: now,
      updatedAt: now,
    };

    let doc = await db.collection(engineKey).findOne({
      projectId: projectObjectId,
      dataItemId: dataItemObjectId,
      type: "guestbook",
    });

    if (!doc) {
      const newDoc = {
        projectOwnerId: project.projectOwnerId,
        createdByUserId: parentCheck.dataItem.createdByUserId,
        projectId: projectObjectId,
        dataItemId: dataItemObjectId,
        type: "guestbook",
        pageSize: PAGE_SIZE,
        pages: [
          {
            pageIndex: 0,
            createdAt: now,
            entries: [newEntry],
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      await db.collection(engineKey).insertOne(newDoc);

      return res.status(201).json({
        message: "Entry added",
        data: { entry: newEntry, pageIndex: 0 },
      });
    }

    const pages = Array.isArray(doc.pages) ? doc.pages : [];
    let lastPage = pages[pages.length - 1];

    if (!lastPage || lastPage.entries.length >= (doc.pageSize || PAGE_SIZE)) {
      lastPage = {
        pageIndex: pages.length,
        createdAt: now,
        entries: [],
      };

      pages.push(lastPage);
    }

    lastPage.entries.push(newEntry);

    await db.collection(engineKey).updateOne(
      { _id: doc._id },
      {
        $set: {
          pages,
          updatedAt: now,
        },
      },
    );

    return res.json({
      message: "Entry added",
      data: { entry: newEntry, pageIndex: lastPage.pageIndex },
    });
  } catch (err) {
    console.error("Add guestbook entry failed:", err);
    return res.status(500).json({
      error: "Failed to add entry",
    });
  }
});

/* ─────────────────────────────
   PUT - Update Entry
───────────────────────────── */
router.put(
  "/update-entry/:dataItemId/:entryId",
  smallJson,
  async (req, res) => {
    const { dataItemId, entryId } = req.params;

    const dataItemValidation = validateGuestbookDataItemIdParam(dataItemId);

    if (!dataItemValidation.isValid) {
      return res.status(400).json({
        error: dataItemValidation.error,
      });
    }

    const entryValidation = validateGuestbookEntryIdParam(entryId);

    if (!entryValidation.isValid) {
      return res.status(400).json({
        error: entryValidation.error,
      });
    }

    const payloadValidation = validateGuestbookUpdateEntryPayload(req.body);

    if (!payloadValidation.isValid) {
      return res.status(400).json({
        error: payloadValidation.error,
      });
    }

    const { projectId, engineKey, updates } = req.body;

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
          error: "Guestbook not found",
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

      const enabledValidation = validateGuestbookEnabled({
        schema: project,
        dataItem: parentCheck.dataItem,
      });

      if (!enabledValidation.isValid) {
        return res.status(400).json({
          error: enabledValidation.error,
        });
      }

      const doc = await db.collection(engineKey).findOne({
        projectId: projectObjectId,
        dataItemId: dataItemObjectId,
        type: "guestbook",
      });

      if (!doc || getGuestbookEntryCount(doc) === 0) {
        return res.status(404).json({
          error: "No guestbook entries found",
        });
      }

      const pages = Array.isArray(doc.pages) ? doc.pages : [];
      const loc = findEntryLocation(pages, entryId);

      if (!loc) {
        return res.status(404).json({
          error: "Entry not found",
        });
      }

      const entry = pages[loc.pageIndex].entries[loc.entryIndex];

      if (updates.name !== undefined) {
        entry.name = updates.name.trim();
      }

      if (updates.comment !== undefined) {
        entry.comment = updates.comment.trim();
      }

      const now = new Date();
      entry.updatedAt = now;

      await db.collection(engineKey).updateOne(
        { _id: doc._id },
        {
          $set: {
            pages,
            updatedAt: now,
          },
        },
      );

      return res.json({
        message: "Entry updated",
        data: { entryId },
      });
    } catch (err) {
      console.error("Update entry failed:", err);
      return res.status(500).json({
        error: "Failed to update entry",
      });
    }
  },
);

/* ─────────────────────────────
   PUT - Toggle Multiple Entries
───────────────────────────── */
router.put("/toggle-entries", smallJson, async (req, res) => {
  const payloadValidation = validateGuestbookToggleEntriesPayload(req.body);

  if (!payloadValidation.isValid) {
    return res.status(400).json({
      error: payloadValidation.error,
    });
  }

  const { projectId, dataItemId, engineKey, entryIds, status } = req.body;

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
        error: "Guestbook not found",
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

    const enabledValidation = validateGuestbookEnabled({
      schema: project,
      dataItem: parentCheck.dataItem,
    });

    if (!enabledValidation.isValid) {
      return res.status(400).json({
        error: enabledValidation.error,
      });
    }

    const doc = await db.collection(engineKey).findOne({
      projectId: projectObjectId,
      dataItemId: dataItemObjectId,
      type: "guestbook",
    });

    if (!doc || getGuestbookEntryCount(doc) === 0) {
      return res.status(404).json({
        error: "No guestbook entries found",
      });
    }

    const entryIdSet = new Set(entryIds);
    const pages = Array.isArray(doc.pages) ? doc.pages : [];
    let updatedCount = 0;
    const now = new Date();

    for (const page of pages) {
      const entries = Array.isArray(page.entries) ? page.entries : [];

      for (const entry of entries) {
        if (entryIdSet.has(entry.id) && entry.status !== status) {
          entry.status = status;
          entry.updatedAt = now;
          updatedCount++;
        }
      }
    }

    if (updatedCount === 0) {
      return res.status(404).json({
        error: "No entries updated",
      });
    }

    await db.collection(engineKey).updateOne(
      { _id: doc._id },
      {
        $set: {
          pages,
          updatedAt: now,
        },
      },
    );

    const message =
      status === "hidden" ? "Entries removed" : "Entries restored";

    return res.json({
      message,
      data: { updatedCount },
    });
  } catch (err) {
    console.error("Toggle entries failed:", err);
    return res.status(500).json({
      error: "Failed to toggle entries",
    });
  }
});

/* ─────────────────────────────
   POST - Remove All Guestbook
───────────────────────────── */
router.post("/remove-all/:dataItemId", smallJson, async (req, res) => {
  const { dataItemId } = req.params;

  const paramValidation = validateGuestbookDataItemIdParam(dataItemId);

  if (!paramValidation.isValid) {
    return res.status(400).json({
      error: paramValidation.error,
    });
  }

  const payloadValidation = validateGuestbookRemoveAllPayload(req.body);

  if (!payloadValidation.isValid) {
    return res.status(400).json({
      error: payloadValidation.error,
    });
  }

  const { projectId, engineKey } = req.body;

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
        error: "Guestbook not found",
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

    const doc = await db.collection(engineKey).findOne({
      projectId: projectObjectId,
      dataItemId: dataItemObjectId,
      type: "guestbook",
    });

    if (!doc) {
      return res.json({
        message: "No guestbook to remove",
        data: { deleted: false },
      });
    }

    const result = await db.collection(engineKey).deleteOne({
      _id: doc._id,
      projectId: projectObjectId,
      dataItemId: dataItemObjectId,
      type: "guestbook",
    });

    const deleted = result.deletedCount === 1;

    return res.json({
      message: deleted ? "Guestbook removed" : "No guestbook to remove",
      data: { deleted },
    });
  } catch (err) {
    console.error("Remove guestbook failed:", err);
    return res.status(500).json({
      error: "Failed to remove guestbook",
    });
  }
});

export default router;
