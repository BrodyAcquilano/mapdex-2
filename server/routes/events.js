// server/routes/events.js
import express from "express";
import { smallJson, mediumJson, extraLargeImportJson } from "../middleware/bodyLimits.js";
import { ObjectId } from "mongodb";
import { getDB } from "../db.js";
import { storage } from "../media/mediaService.js";
import { hasProjectAccess } from "../utils/projectPermissions.js";
import { getDataItemUserRole } from "../utils/dataItemPermissions.js";
import { PROJECT_LIMITS } from "../../shared/validation/validationConstants.js";
import {
  normalizeTagListSections,
  mergeTagsIntoProjectSections,
  recomputeProjectTagSections,
  removeUnusedCustomTagsAfterDataItemUpdate,
} from "../utils/tagListHelpers.js";
import {
  normalizePriceRangeSections,
  recomputeProjectPriceSections,
} from "../utils/priceRangeHelpers.js";
import {
  hasExactKeys,
  validateDataItemPayload,
  validateExtensionsPayload,
  validateGeometryPayload,
} from "../../shared/validation/dataValidation.js";
import { buildDataItemFieldsFromForm } from "../utils/dataUtils.js";
import { reapplyTimezoneFromLatLng } from "../../shared/time/reapplyTimezoneFromLatLng.js";
import { geometryCrossesAntimeridian } from "../../shared/validation/geometryBoundaryValidation.js";

const router = express.Router();

/* ─────────────────────────────
   POST - Get All Events
───────────────────────────── */
router.post("/get", smallJson, async (req, res) => {
    if (!hasExactKeys(req.body, ["projectId"])) {
    return res.status(400).json({
      error: "Invalid get events payload.",
    });
  }
  const { projectId } = req.body;

  if (!projectId) {
    return res.status(400).json({ error: "Missing projectId." });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);

    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized." });
    }

    const access = hasProjectAccess(project, userId, "viewer");

    if (!access.hasAccess) {
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized." });
    }

    const events = await db
      .collection("events")
      .find({
        projectId: projectObjectId,
        type: "event",
      })
      .toArray();

    if (events.length === 0) {
      return res.json({
        message: "No events found",
        data: [],
      });
    }

    const safeEvents = events.map((event) => {
      const safeEvent = {
        ...event,
        userRole: getDataItemUserRole(event, userId, access),
      };

      delete safeEvent.projectOwnerId;
      delete safeEvent.createdByUserId;

      return safeEvent;
    });

    return res.json({
      message: "Events retrieved",
      data: safeEvents,
    });
  } catch (err) {
    console.error("Fetch failed:", err);
    return res.status(500).json({ error: "Failed to fetch events" });
  }
});

/* ─────────────────────────────
   POST - Get One Event
───────────────────────────── */
router.post("/get/:_id", smallJson, async (req, res) => {
    if (!hasExactKeys(req.body, ["projectId"])) {
    return res.status(400).json({
      error: "Invalid get event payload.",
    });
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
    const eventObjectId = new ObjectId(_id);

    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized." });
    }

    const access = hasProjectAccess(project, userId, "viewer");

    if (!access.hasAccess) {
      return res
        .status(404)
        .json({ error: "Event not found or unauthorized." });
    }

    const event = await db.collection("events").findOne({
      projectId: projectObjectId,
      _id: eventObjectId,
      type: "event",
    });

    if (!event) {
      return res
        .status(404)
        .json({ error: "Event not found or unauthorized." });
    }

    const safeEvent = {
      ...event,
      userRole: getDataItemUserRole(event, userId, access),
    };

    delete safeEvent.projectOwnerId;
    delete safeEvent.createdByUserId;

    return res.json({
      message: "Event retrieved",
      data: safeEvent,
    });
  } catch (err) {
    console.error("Fetch one failed:", err);
    return res.status(500).json({ error: "Failed to fetch event" });
  }
});

/* ─────────────────────────────
   POST - Add Event
───────────────────────────── */
router.post("/add", mediumJson, async (req, res) => {
    if (!hasExactKeys(req.body, ["projectId", "schemaUpdatedAt", "event"])) {
    return res.status(400).json({
      error: "Invalid add event payload.",
    });
  }

  const { projectId, schemaUpdatedAt, event } = req.body;

  if (!projectId || !schemaUpdatedAt || !event) {
    return res
      .status(400)
      .json({ error: "Missing projectId, schemaUpdatedAt, or event." });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);

    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized." });
    }

    const access = hasProjectAccess(project, userId, "editor");

    if (!access.hasAccess) {
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized." });
    }

    const incomingSchemaUpdatedAt = new Date(schemaUpdatedAt);
    const databaseSchemaUpdatedAt = new Date(project.updatedAt);

    if (
      !Number.isFinite(incomingSchemaUpdatedAt.getTime()) ||
      !Number.isFinite(databaseSchemaUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid schema timestamp. Reload before adding.",
      });
    }

    if (
      incomingSchemaUpdatedAt.getTime() !== databaseSchemaUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This project's schema has changed since you loaded it. Reload before adding.",
      });
    }

    const existingEvents = await db
      .collection("events")
      .find({
        projectId: projectObjectId,
        type: "event",
      })
      .toArray();

    if (existingEvents.length >= PROJECT_LIMITS.maxDataItems) {
      return res.status(400).json({
        error: `This project has reached the maximum of ${PROJECT_LIMITS.maxDataItems} events.`,
      });
    }

    const validation = validateDataItemPayload({
      schema: project,
      dataItem: event,
      mode: "add",
    });

    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.error || "Invalid event payload.",
      });
    }

    const layer = Number(event.layer);
    let parentDataItemId = null;

    if (layer === 2) {
      if (!ObjectId.isValid(event.parentDataItemId)) {
        return res.status(400).json({
          error: "Invalid parent data item.",
        });
      }

      parentDataItemId = new ObjectId(event.parentDataItemId);

      const parentEvent = await db.collection("events").findOne({
        projectId: projectObjectId,
        _id: parentDataItemId,
        type: "event",
        layer: 1,
      });

      if (!parentEvent) {
        return res.status(400).json({
          error: "Invalid parent data item.",
        });
      }
    }

    const safeEvent = buildDataItemFieldsFromForm(project, event, {
      includeExtensions: true,
    });

    if (!safeEvent) {
      return res.status(400).json({ error: "Invalid event payload." });
    }

    safeEvent.sections = normalizeTagListSections(
      project.sections,
      safeEvent.sections,
    );

    safeEvent.sections = normalizePriceRangeSections(
      project.sections,
      safeEvent.sections,
    );

    const now = new Date();

    const insertDoc =
      layer === 2
        ? {
            projectId: projectObjectId,
            projectOwnerId: project.projectOwnerId,
            createdByUserId: userId,
            type: "event",
            layer,
            parentDataItemId,
            geometry: safeEvent.geometry,
            time: safeEvent.time,
            sections: safeEvent.sections,
            extensions: safeEvent.extensions,
            createdAt: now,
            updatedAt: now,
          }
        : {
            projectId: projectObjectId,
            projectOwnerId: project.projectOwnerId,
            createdByUserId: userId,
            type: "event",
            layer,
            geometry: safeEvent.geometry,
            time: safeEvent.time,
            sections: safeEvent.sections,
            extensions: safeEvent.extensions,
            createdAt: now,
            updatedAt: now,
          };

    const prospectiveEvents = [...existingEvents, insertDoc];

    const { nextSections: tagMergedSections, addedCustomTags } =
      mergeTagsIntoProjectSections(project.sections, insertDoc.sections);

    const {
      nextSections,
      addedCustomCategories,
      removedCustomCategories,
      addedCustomUnits,
      removedCustomUnits,
    } = recomputeProjectPriceSections(tagMergedSections, prospectiveEvents);

    const result = await db.collection("events").insertOne(insertDoc);

    const shouldUpdateProject =
      addedCustomTags.length > 0 ||
      addedCustomCategories.length > 0 ||
      removedCustomCategories.length > 0 ||
      addedCustomUnits.length > 0 ||
      removedCustomUnits.length > 0;

    let schemaUpdatedAtResult = project.updatedAt;

    if (shouldUpdateProject) {
      schemaUpdatedAtResult = new Date();

      await db.collection("projects").updateOne(
        { _id: projectObjectId },
        {
          $set: {
            sections: nextSections,
            updatedAt: schemaUpdatedAtResult,
          },
        },
      );
    }

    const safeInsertedEvent = {
      _id: result.insertedId,
      ...insertDoc,
    };

    delete safeInsertedEvent.projectOwnerId;
    delete safeInsertedEvent.createdByUserId;

    return res.status(201).json({
      message: "Event added",
      data: safeInsertedEvent,
      schemaUpdatedAt: schemaUpdatedAtResult,
      addedCustomTags,
      addedCustomCategories,
      removedCustomCategories,
      addedCustomUnits,
      removedCustomUnits,
    });
  } catch (err) {
    console.error("Insert failed:", err);

    if (err?.status === 400) {
      return res.status(400).json({
        error: err.message || "Invalid tag list or price range data.",
      });
    }

    return res.status(500).json({ error: "Failed to add event" });
  }
});

/* ─────────────────────────────
   POST - Add event batch (import geometry)
   Mirrors places.js's own /add-batch exactly (see that route's own
   comment for the full reasoning) - tolerates individually bad items
   rather than aborting the whole request, applies
   geometryCrossesAntimeridian as an extra defense on top of the
   regular validateDataItemPayload check, and skips the tag/price
   project-schema merge entirely (a geometry-only import never
   introduces a new custom tag/category/unit).
───────────────────────────── */
router.post("/add-batch", extraLargeImportJson, async (req, res) => {
  if (!hasExactKeys(req.body, ["projectId", "events"])) {
    return res.status(400).json({
      error: "Invalid add event batch payload.",
    });
  }

  const { projectId, events } = req.body;

  if (!projectId || !Array.isArray(events) || events.length === 0) {
    return res.status(400).json({
      error: "Missing projectId or events.",
    });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
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

    const access = hasProjectAccess(project, userId, "editor");

    if (!access.hasAccess) {
      return res.status(404).json({
        error: "Project not found or unauthorized.",
      });
    }

    const existingEventCount = await db.collection("events").countDocuments({
      projectId: projectObjectId,
      type: "event",
    });

    if (existingEventCount + events.length > PROJECT_LIMITS.maxDataItems) {
      return res.status(400).json({
        error:
          `This project has reached the maximum of ${PROJECT_LIMITS.maxDataItems} events. ` +
          `You currently have ${existingEventCount}, and this import would add ${events.length}.`,
      });
    }

    const survivingIndexes = [];
    const insertDocs = [];

    for (let i = 0; i < events.length; i += 1) {
      const event = events[i];

      const validation = validateDataItemPayload({
        schema: project,
        dataItem: event,
        mode: "add",
      });

      if (!validation.isValid) continue;
      if (geometryCrossesAntimeridian(event.geometry)) continue;

      const layer = Number(event.layer);
      let parentDataItemId = null;

      if (layer === 2) {
        if (!ObjectId.isValid(event.parentDataItemId)) continue;

        parentDataItemId = new ObjectId(event.parentDataItemId);

        const parentEvent = await db.collection("events").findOne({
          projectId: projectObjectId,
          _id: parentDataItemId,
          type: "event",
          layer: 1,
        });

        if (!parentEvent) continue;
      }

      const safeEvent = buildDataItemFieldsFromForm(project, event, {
        includeExtensions: true,
      });

      if (!safeEvent) continue;

      safeEvent.sections = normalizeTagListSections(
        project.sections,
        safeEvent.sections,
      );

      safeEvent.sections = normalizePriceRangeSections(
        project.sections,
        safeEvent.sections,
      );

      const insertDoc =
        layer === 2
          ? {
              projectId: projectObjectId,
              projectOwnerId: project.projectOwnerId,
              createdByUserId: userId,
              type: "event",
              layer,
              parentDataItemId,
              geometry: safeEvent.geometry,
              time: safeEvent.time,
              sections: safeEvent.sections,
              extensions: safeEvent.extensions,
              createdAt: now,
              updatedAt: now,
            }
          : {
              projectId: projectObjectId,
              projectOwnerId: project.projectOwnerId,
              createdByUserId: userId,
              type: "event",
              layer,
              geometry: safeEvent.geometry,
              time: safeEvent.time,
              sections: safeEvent.sections,
              extensions: safeEvent.extensions,
              createdAt: now,
              updatedAt: now,
            };

      survivingIndexes.push(i);
      insertDocs.push(insertDoc);
    }

    if (insertDocs.length === 0) {
      return res.status(400).json({
        error: "No valid events to import.",
      });
    }

    const result = await db.collection("events").insertMany(insertDocs);
    const insertedIdsByOffset = Object.values(result.insertedIds);

    const inserted = survivingIndexes.map((originalIndex, offset) => ({
      index: originalIndex,
      _id: insertedIdsByOffset[offset],
      createdAt: now,
      updatedAt: now,
    }));

    const rejectedCount = events.length - inserted.length;

    return res.status(201).json({
      message:
        rejectedCount > 0
          ? `${inserted.length} of ${events.length} events imported (${rejectedCount} rejected).`
          : `${inserted.length} events imported.`,
      data: {
        inserted,
        insertedCount: inserted.length,
        rejectedCount,
      },
    });
  } catch (err) {
    console.error("Batch insert failed:", err);

    if (err?.status === 400) {
      return res.status(400).json({
        error: err.message || "Invalid tag list or price range data.",
      });
    }

    return res.status(500).json({ error: "Failed to add event batch" });
  }
});

/* ─────────────────────────────
   PUT - Update Event
───────────────────────────── */
router.put("/update/:_id", mediumJson, async (req, res) => {
    if (!hasExactKeys(req.body, ["projectId", "schemaUpdatedAt", "event"])) {
    return res.status(400).json({
      error: "Invalid update event payload.",
    });
  }

  const { projectId, schemaUpdatedAt, event } = req.body;
  const { _id } = req.params;

  if (!projectId || !schemaUpdatedAt || !event || !_id) {
    return res
      .status(400)
      .json({ error: "Missing projectId, schemaUpdatedAt, event, or _id." });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);
    const eventObjectId = new ObjectId(_id);

    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized." });
    }

    const access = hasProjectAccess(project, userId, "editor");

    if (!access.hasAccess) {
      return res
        .status(404)
        .json({ error: "Event not found or unauthorized." });
    }

    const incomingSchemaUpdatedAt = new Date(schemaUpdatedAt);
    const databaseSchemaUpdatedAt = new Date(project.updatedAt);

    if (
      !Number.isFinite(incomingSchemaUpdatedAt.getTime()) ||
      !Number.isFinite(databaseSchemaUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid schema timestamp. Reload before updating.",
      });
    }

    if (
      incomingSchemaUpdatedAt.getTime() !== databaseSchemaUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This project's schema has changed since you loaded it. Reload before updating.",
      });
    }

    const existingEvent = await db.collection("events").findOne({
      projectId: projectObjectId,
      _id: eventObjectId,
      type: "event",
    });

    if (!existingEvent) {
      return res
        .status(404)
        .json({ error: "Event not found or unauthorized." });
    }

    const canEditAny = access.isAdmin;
    const isCreatedByUser =
      String(existingEvent.createdByUserId || "") === String(userId);

    if (!canEditAny && !isCreatedByUser) {
      return res.status(403).json({
        error: "Editors can only update events they created.",
      });
    }

    const validation = validateDataItemPayload({
      schema: project,
      dataItem: event,
      mode: "update",
    });

    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.error || "Invalid event payload.",
      });
    }

    if (String(event._id) !== String(_id)) {
      return res.status(400).json({
        error: "Invalid event payload.",
      });
    }

    const incomingEventUpdatedAt = new Date(event.updatedAt);
    const databaseEventUpdatedAt = new Date(existingEvent.updatedAt);

    if (
      !Number.isFinite(incomingEventUpdatedAt.getTime()) ||
      !Number.isFinite(databaseEventUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid event timestamp. Reload before updating.",
      });
    }

    if (incomingEventUpdatedAt.getTime() !== databaseEventUpdatedAt.getTime()) {
      return res.status(409).json({
        error:
          "This event has changed since you loaded it. Reload before updating.",
      });
    }

    const safeEvent = buildDataItemFieldsFromForm(project, event, {
      includeExtensions: false,
      existingGeometry: existingEvent.geometry,
    });

    if (!safeEvent) {
      return res.status(400).json({ error: "Invalid event payload." });
    }

    safeEvent.sections = normalizeTagListSections(
      project.sections,
      safeEvent.sections,
    );

    safeEvent.sections = normalizePriceRangeSections(
      project.sections,
      safeEvent.sections,
    );

    const now = new Date();

    const prospectiveUpdatedEvent = {
      ...existingEvent,
      ...safeEvent,
      updatedAt: now,
    };

    const otherEvents = await db
      .collection("events")
      .find({
        projectId: projectObjectId,
        type: "event",
        _id: { $ne: eventObjectId },
      })
      .toArray();

    const prospectiveEvents = [...otherEvents, prospectiveUpdatedEvent];

    const { nextSections: tagMergedSections, addedCustomTags } =
      mergeTagsIntoProjectSections(
        project.sections,
        prospectiveUpdatedEvent.sections,
      );

    const { nextSections: tagCleanedSections, removedCustomTags } =
      removeUnusedCustomTagsAfterDataItemUpdate(
        tagMergedSections,
        existingEvent.sections,
        prospectiveUpdatedEvent.sections,
        otherEvents,
      );

    const {
      nextSections,
      addedCustomCategories,
      removedCustomCategories,
      addedCustomUnits,
      removedCustomUnits,
    } = recomputeProjectPriceSections(tagCleanedSections, prospectiveEvents);

    const updateResult = await db.collection("events").findOneAndUpdate(
      {
        projectId: projectObjectId,
        _id: eventObjectId,
        type: "event",
      },
      {
        $set: {
          ...safeEvent,
          updatedAt: now,
        },
      },
      {
        returnDocument: "after",
      },
    );

    const updatedEvent = updateResult?.value;

    if (!updatedEvent) {
      return res
        .status(404)
        .json({ error: "Event not found or unauthorized." });
    }

    const shouldUpdateProject =
      addedCustomTags.length > 0 ||
      removedCustomTags.length > 0 ||
      addedCustomCategories.length > 0 ||
      removedCustomCategories.length > 0 ||
      addedCustomUnits.length > 0 ||
      removedCustomUnits.length > 0;

    let schemaUpdatedAtResult = project.updatedAt;

    if (shouldUpdateProject) {
      schemaUpdatedAtResult = new Date();

      await db.collection("projects").updateOne(
        { _id: projectObjectId },
        {
          $set: {
            sections: nextSections,
            updatedAt: schemaUpdatedAtResult,
          },
        },
      );
    }

    const safeUpdatedEvent = { ...updatedEvent };

    delete safeUpdatedEvent.projectOwnerId;
    delete safeUpdatedEvent.createdByUserId;

    return res.json({
      message: "Event updated",
      data: safeUpdatedEvent,
      schemaUpdatedAt: schemaUpdatedAtResult,
      addedCustomTags,
      removedCustomTags,
      addedCustomCategories,
      removedCustomCategories,
      addedCustomUnits,
      removedCustomUnits,
    });
  } catch (err) {
    console.error("Update failed:", err);

    if (err?.status === 400) {
      return res.status(400).json({
        error: err.message || "Invalid tag list or price range data.",
      });
    }

    return res.status(500).json({ error: "Failed to update event" });
  }
});

/* ─────────────────────────────
   DELETE - Remove Event (Cascade Cleanup)
───────────────────────────── */
router.delete("/remove/:_id", smallJson, async (req, res) => {
    if (!hasExactKeys(req.body, ["projectId", "schemaUpdatedAt", "updatedAt"])) {
    return res.status(400).json({
      error: "Invalid remove event payload.",
    });
  }

  const { projectId, schemaUpdatedAt, updatedAt } = req.body;
  const { _id } = req.params;

  if (!projectId || !schemaUpdatedAt || !updatedAt || !_id) {
    return res.status(400).json({
      error: "Missing projectId, schemaUpdatedAt, updatedAt, or _id.",
    });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);
    const eventObjectId = new ObjectId(_id);

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
        error: "Event not found or unauthorized.",
      });
    }

    const incomingSchemaUpdatedAt = new Date(schemaUpdatedAt);
    const databaseSchemaUpdatedAt = new Date(project.updatedAt);

    if (
      !Number.isFinite(incomingSchemaUpdatedAt.getTime()) ||
      !Number.isFinite(databaseSchemaUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid schema timestamp. Reload before deleting.",
      });
    }

    if (
      incomingSchemaUpdatedAt.getTime() !== databaseSchemaUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This project's schema has changed since you loaded it. Reload before deleting.",
      });
    }

    const existingEvent = await db.collection("events").findOne({
      projectId: projectObjectId,
      _id: eventObjectId,
      type: "event",
    });

    if (!existingEvent) {
      return res.status(404).json({
        error: "Event not found or unauthorized.",
      });
    }

    const canEditAny = access.isAdmin;
    const isCreatedByUser =
      String(existingEvent.createdByUserId || "") === String(userId);

    if (!canEditAny && !isCreatedByUser) {
      return res.status(403).json({
        error: "Editors can only delete events they created.",
      });
    }

    const incomingEventUpdatedAt = new Date(updatedAt);
    const databaseEventUpdatedAt = new Date(existingEvent.updatedAt);

    if (
      !Number.isFinite(incomingEventUpdatedAt.getTime()) ||
      !Number.isFinite(databaseEventUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid event timestamp. Reload before deleting.",
      });
    }

    if (incomingEventUpdatedAt.getTime() !== databaseEventUpdatedAt.getTime()) {
      return res.status(409).json({
        error:
          "This event has changed since you loaded it. Reload before deleting.",
      });
    }

    const summary = [];

    async function removeEventExtensionData(dataItemId) {
      const extensionSummary = [];

      /* ─────────────────────────────
         Remove Gallery Images
      ───────────────────────────── */
      const images = await db
        .collection("events")
        .find({
          projectId: projectObjectId,
          dataItemId,
          type: "image",
        })
        .toArray();

      if (images.length > 0) {
        for (const img of images) {
          if (img.original?.r2Key) {
            await storage.removeObject(img.original.r2Key);
          }

          if (img.thumb?.r2Key) {
            await storage.removeObject(img.thumb.r2Key);
          }
        }

        const imageDeleteResult = await db.collection("events").deleteMany({
          projectId: projectObjectId,
          dataItemId,
          type: "image",
        });

        if (imageDeleteResult.deletedCount > 0) {
          extensionSummary.push(
            `${imageDeleteResult.deletedCount} gallery images removed`,
          );
        }
      }

      /* ─────────────────────────────
         Remove Guestbook
      ───────────────────────────── */
      const guestbookResult = await db.collection("events").deleteOne({
        projectId: projectObjectId,
        dataItemId,
        type: "guestbook",
      });

      if (guestbookResult.deletedCount === 1) {
        extensionSummary.push("Guestbook removed");
      }

      return extensionSummary;
    }

    /* ─────────────────────────────
       Remove Layer 2 Child Events First
    ───────────────────────────── */
    if (Number(existingEvent.layer) === 1) {
      const childEvents = await db
        .collection("events")
        .find({
          projectId: projectObjectId,
          type: "event",
          layer: 2,
          parentDataItemId: eventObjectId,
        })
        .toArray();

      if (childEvents.length > 0) {
        for (const childEvent of childEvents) {
          await removeEventExtensionData(childEvent._id);
        }

        const childDeleteResult = await db.collection("events").deleteMany({
          projectId: projectObjectId,
          type: "event",
          layer: 2,
          parentDataItemId: eventObjectId,
        });

        if (childDeleteResult.deletedCount > 0) {
          summary.push(`${childDeleteResult.deletedCount} layer 2 events removed`);
        }
      }
    }

    /* ─────────────────────────────
       Remove Target Event Extension Data
    ───────────────────────────── */
    const targetExtensionSummary = await removeEventExtensionData(eventObjectId);
    summary.push(...targetExtensionSummary);

    /* ─────────────────────────────
       Remove Target Event
    ───────────────────────────── */
    const eventDeleteResult = await db.collection("events").deleteOne({
      projectId: projectObjectId,
      _id: eventObjectId,
      type: "event",
    });

    if (eventDeleteResult.deletedCount !== 1) {
      return res.status(404).json({
        error: "Event not found or unauthorized.",
      });
    }

    summary.push("Event removed");

    const remainingEvents = await db
      .collection("events")
      .find({
        projectId: projectObjectId,
        type: "event",
      })
      .toArray();

    const { nextSections: tagRecomputedSections, removedCustomTags } =
      recomputeProjectTagSections(project.sections, remainingEvents);

    const {
      nextSections,
      addedCustomCategories,
      removedCustomCategories,
      addedCustomUnits,
      removedCustomUnits,
    } = recomputeProjectPriceSections(tagRecomputedSections, remainingEvents);

    const shouldUpdateProject =
      removedCustomTags.length > 0 ||
      addedCustomCategories.length > 0 ||
      removedCustomCategories.length > 0 ||
      addedCustomUnits.length > 0 ||
      removedCustomUnits.length > 0;

    let schemaUpdatedAtResult = project.updatedAt;

    if (shouldUpdateProject) {
      schemaUpdatedAtResult = new Date();

      await db.collection("projects").updateOne(
        { _id: projectObjectId },
        {
          $set: {
            sections: nextSections,
            updatedAt: schemaUpdatedAtResult,
          },
        },
      );
    }

    return res.json({
      message: summary.join("\n"),
      data: { _id },
      schemaUpdatedAt: schemaUpdatedAtResult,
      removedCustomTags,
      addedCustomCategories,
      removedCustomCategories,
      addedCustomUnits,
      removedCustomUnits,
    });
  } catch (err) {
    console.error("Delete failed:", err);

    if (err?.status === 400) {
      return res.status(400).json({
        error: err.message || "Invalid tag list or price range data.",
      });
    }

    return res.status(500).json({
      error: "Failed to remove event",
    });
  }
});

/*
 * PUT - Update Event Geometry
 *
 * Generic geometry-overwrite route: any front-end tool that produces
 * a new, fully valid geometry for this item (drag-to-move, remove a
 * vertex, insert a midpoint, ...) sends the finished result here. The
 * route itself doesn't know or care which tool produced it - it just
 * validates the geometry the same way add does (full validation, not
 * the colors-only update-mode validator) and overwrites the stored
 * geometry if it passes, matching the shared front-end/back-end
 * geometry calculation functions in shared/validation/*.js.
 */
router.put("/update-geometry/:_id", smallJson, async (req, res) => {
  if (
    !hasExactKeys(req.body, [
      "projectId",
      "schemaUpdatedAt",
      "geometry",
      "updatedAt",
    ])
  ) {
    return res.status(400).json({
      error: "Invalid geometry update payload.",
    });
  }

  const {
    projectId,
    schemaUpdatedAt,
    geometry,
    updatedAt,
  } = req.body;

  const { _id } = req.params;

  if (
    !projectId ||
    !schemaUpdatedAt ||
    !geometry ||
    !updatedAt ||
    !_id
  ) {
    return res.status(400).json({
      error:
        "Missing projectId, schemaUpdatedAt, geometry, updatedAt, or _id.",
    });
  }

  try {
    const db = getDB();

    const userId =
      new ObjectId(req.userId);

    const projectObjectId =
      new ObjectId(projectId);

    const eventObjectId =
      new ObjectId(_id);

    const project =
      await db.collection("projects").findOne({
        _id: projectObjectId,
      });

    if (!project) {
      return res
        .status(404)
        .json({
          error:
            "Project not found or unauthorized.",
        });
    }

    const access =
      hasProjectAccess(
        project,
        userId,
        "editor",
      );

    if (!access.hasAccess) {
      return res
        .status(404)
        .json({
          error:
            "Event not found or unauthorized.",
        });
    }

    const incomingSchemaUpdatedAt =
      new Date(schemaUpdatedAt);

    const databaseSchemaUpdatedAt =
      new Date(project.updatedAt);

    if (
      !Number.isFinite(
        incomingSchemaUpdatedAt.getTime(),
      ) ||
      !Number.isFinite(
        databaseSchemaUpdatedAt.getTime(),
      )
    ) {
      return res.status(400).json({
        error:
          "Invalid schema timestamp. Reload before continuing.",
      });
    }

    if (
      incomingSchemaUpdatedAt.getTime() !==
      databaseSchemaUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This project's schema has changed since you loaded it. Reload before continuing.",
      });
    }

    const existingEvent =
      await db.collection("events").findOne({
        projectId: projectObjectId,
        _id: eventObjectId,
        type: "event",
      });

    if (!existingEvent) {
      return res
        .status(404)
        .json({
          error:
            "Event not found or unauthorized.",
        });
    }

    const canEditAny =
      access.isAdmin;

    const isCreatedByUser =
      String(
        existingEvent.createdByUserId || "",
      ) === String(userId);

    if (
      !canEditAny &&
      !isCreatedByUser
    ) {
      return res.status(403).json({
        error:
          "Editors can only edit the geometry of events they created.",
      });
    }

    const incomingEventUpdatedAt =
      new Date(updatedAt);

    const databaseEventUpdatedAt =
      new Date(existingEvent.updatedAt);

    if (
      !Number.isFinite(
        incomingEventUpdatedAt.getTime(),
      ) ||
      !Number.isFinite(
        databaseEventUpdatedAt.getTime(),
      )
    ) {
      return res.status(400).json({
        error:
          "Invalid event timestamp. Reload before continuing.",
      });
    }

    if (
      incomingEventUpdatedAt.getTime() !==
      databaseEventUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This event has changed since you loaded it. Reload before continuing.",
      });
    }

    if (
      !validateGeometryPayload(
        project,
        geometry,
        { mode: "move" },
      )
    ) {
      return res.status(400).json({
        error: "Invalid geometry.",
      });
    }

  const safeGeometry =
  structuredClone(geometry);

const timezoneTarget = {
  geometry: safeGeometry,

  time: structuredClone(
    existingEvent.time || {},
  ),
};

reapplyTimezoneFromLatLng(
  timezoneTarget,
);

const nextTime =
  timezoneTarget.time;

const now = new Date();

    const updateResult =
      await db
        .collection("events")
        .findOneAndUpdate(
          {
            projectId: projectObjectId,
            _id: eventObjectId,
            type: "event",
          },
          {
            $set: {
              geometry: safeGeometry,
              time: nextTime,
              updatedAt: now,
            },
          },
          {
            returnDocument: "after",
          },
        );

    const updatedEvent =
      updateResult?.value;

    if (!updatedEvent) {
      return res
        .status(404)
        .json({
          error:
            "Event not found or unauthorized.",
        });
    }

    return res.json({
      message: "Event moved",
      data: {
        _id: updatedEvent._id,
        geometry:
          updatedEvent.geometry,
        time:
          updatedEvent.time,
        updatedAt:
          updatedEvent.updatedAt,
      },
    });
  } catch (err) {
    console.error(
      "Move update failed:",
      err,
    );

    return res.status(500).json({
      error:
        "Failed to move event geometry",
    });
  }
});

/* ─────────────────────────────
   PUT - Toggle Event Extensions
───────────────────────────── */
router.put("/toggle-extensions/:_id", smallJson, async (req, res) => {
   if (
    !hasExactKeys(req.body, [
      "projectId",
      "schemaUpdatedAt",
      "extensions",
      "updatedAt",
    ])
  ) {
    return res.status(400).json({
      error: "Invalid toggle event extensions payload.",
    });
  }
  
  const { projectId, schemaUpdatedAt, extensions, updatedAt } = req.body;
  const { _id } = req.params;

  if (!projectId || !schemaUpdatedAt || !extensions || !updatedAt || !_id) {
    return res.status(400).json({
      error:
        "Missing projectId, schemaUpdatedAt, extensions, updatedAt, or _id.",
    });
  }

  try {
    const db = getDB();
    const userId = new ObjectId(req.userId);
    const projectObjectId = new ObjectId(projectId);
    const eventObjectId = new ObjectId(_id);

    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return res
        .status(404)
        .json({ error: "Project not found or unauthorized." });
    }

    const access = hasProjectAccess(project, userId, "editor");

    if (!access.hasAccess) {
      return res
        .status(404)
        .json({ error: "Event not found or unauthorized." });
    }

    const incomingSchemaUpdatedAt = new Date(schemaUpdatedAt);
    const databaseSchemaUpdatedAt = new Date(project.updatedAt);

    if (
      !Number.isFinite(incomingSchemaUpdatedAt.getTime()) ||
      !Number.isFinite(databaseSchemaUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid schema timestamp. Reload before updating extensions.",
      });
    }

    if (
      incomingSchemaUpdatedAt.getTime() !== databaseSchemaUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        error:
          "This project's schema has changed since you loaded it. Reload before updating extensions.",
      });
    }

    const existingEvent = await db.collection("events").findOne({
      projectId: projectObjectId,
      _id: eventObjectId,
      type: "event",
    });

    if (!existingEvent) {
      return res
        .status(404)
        .json({ error: "Event not found or unauthorized." });
    }

    const canEditAny = access.isAdmin;
    const isCreatedByUser =
      String(existingEvent.createdByUserId || "") === String(userId);

    if (!canEditAny && !isCreatedByUser) {
      return res.status(403).json({
        error: "Editors can only update extensions for events they created.",
      });
    }

    const incomingUpdatedAt = new Date(updatedAt);
    const databaseUpdatedAt = new Date(existingEvent.updatedAt);

    if (
      !Number.isFinite(incomingUpdatedAt.getTime()) ||
      !Number.isFinite(databaseUpdatedAt.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid event timestamp. Reload before updating extensions.",
      });
    }

    if (incomingUpdatedAt.getTime() !== databaseUpdatedAt.getTime()) {
      return res.status(409).json({
        error:
          "This event has changed since you loaded it. Reload before updating extensions.",
      });
    }

    if (!validateExtensionsPayload(project, extensions)) {
      return res.status(400).json({
        error: "Invalid extensions.",
      });
    }

    const safeExtensions = structuredClone(extensions);

    const wasGalleryEnabled = existingEvent.extensions?.Gallery === true;
    const nextGalleryEnabled = safeExtensions.Gallery === true;

    const wasGuestbookEnabled = existingEvent.extensions?.Guestbook === true;
    const nextGuestbookEnabled = safeExtensions.Guestbook === true;

    const summary = [];

    if (wasGalleryEnabled && !nextGalleryEnabled) {
      const images = await db
        .collection("events")
        .find({
          projectId: projectObjectId,
          dataItemId: eventObjectId,
          type: "image",
        })
        .toArray();

      if (images.length > 0) {
        for (const img of images) {
          if (img.original?.r2Key) {
            await storage.removeObject(img.original.r2Key);
          }

          if (img.thumb?.r2Key) {
            await storage.removeObject(img.thumb.r2Key);
          }
        }

        const imageDeleteResult = await db.collection("events").deleteMany({
          projectId: projectObjectId,
          dataItemId: eventObjectId,
          type: "image",
        });

        if (imageDeleteResult.deletedCount > 0) {
          summary.push(
            `${imageDeleteResult.deletedCount} gallery images removed`,
          );
        }
      }
    }

    if (wasGuestbookEnabled && !nextGuestbookEnabled) {
      const guestbookDeleteResult = await db.collection("events").deleteOne({
        projectId: projectObjectId,
        dataItemId: eventObjectId,
        type: "guestbook",
      });

      if (guestbookDeleteResult.deletedCount === 1) {
        summary.push("Guestbook removed");
      }
    }

    const now = new Date();

    const updateResult = await db.collection("events").findOneAndUpdate(
      {
        projectId: projectObjectId,
        _id: eventObjectId,
        type: "event",
      },
      {
        $set: {
          extensions: safeExtensions,
          updatedAt: now,
        },
      },
      {
        returnDocument: "after",
      },
    );

    const updatedEvent = updateResult?.value;

    if (!updatedEvent) {
      return res
        .status(404)
        .json({ error: "Event not found or unauthorized." });
    }

    summary.push("Event extensions updated");

    return res.json({
      message: summary.join("\n"),
      data: {
        _id: updatedEvent._id,
        updatedAt: updatedEvent.updatedAt,
      },
    });
  } catch (err) {
    console.error("Toggle extensions failed:", err);
    return res.status(500).json({
      error: "Failed to update event extensions",
    });
  }
});

export default router;