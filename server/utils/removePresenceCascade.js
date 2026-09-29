// server/utils/removePresenceCascade.js

import { ObjectId } from "mongodb";
import { storage } from "../media/mediaService.js";
import { recomputeProjectTagSections } from "./tagListHelpers.js";
import { recomputeProjectPriceSections } from "./priceRangeHelpers.js";

export async function removePresenceCascade(
  db,
  project,
  presenceDoc,
) {
  if (
    !presenceDoc?._id ||
    !presenceDoc?.projectId
  ) {
    throw new Error(
      "Missing presenceDoc._id or presenceDoc.projectId",
    );
  }

  if (
    !project?._id ||
    !Array.isArray(project?.sections)
  ) {
    throw new Error(
      "Missing project._id or project.sections",
    );
  }

  if (
    String(project._id) !==
    String(presenceDoc.projectId)
  ) {
    throw new Error(
      "Project does not match presenceDoc.projectId",
    );
  }

  const presenceObjectId =
    typeof presenceDoc._id === "string"
      ? new ObjectId(
          presenceDoc._id,
        )
      : presenceDoc._id;

  const projectObjectId =
    typeof presenceDoc.projectId ===
    "string"
      ? new ObjectId(
          presenceDoc.projectId,
        )
      : presenceDoc.projectId;

  const summary = [];

  /* ─────────────────────────────
     Remove Gallery Images
  ───────────────────────────── */
  const images = await db
    .collection("presence")
    .find({
      projectId: projectObjectId,
      dataItemId: presenceObjectId,
      type: "image",
    })
    .toArray();

  if (images.length > 0) {
    for (const img of images) {
      if (img.original?.r2Key) {
        await storage.removeObject(
          img.original.r2Key,
        );
      }

      if (img.thumb?.r2Key) {
        await storage.removeObject(
          img.thumb.r2Key,
        );
      }
    }

    const imageDeleteResult =
      await db
        .collection("presence")
        .deleteMany({
          projectId:
            projectObjectId,
          dataItemId:
            presenceObjectId,
          type: "image",
        });

    if (
      imageDeleteResult.deletedCount >
      0
    ) {
      summary.push(
        `${imageDeleteResult.deletedCount} gallery images removed`,
      );
    }
  }

  /* ─────────────────────────────
     Remove Presence
  ───────────────────────────── */
  const presenceDeleteResult =
    await db
      .collection("presence")
      .deleteOne({
        projectId:
          projectObjectId,
        _id: presenceObjectId,
        type: "presence",
      });

  if (
    presenceDeleteResult.deletedCount ===
    1
  ) {
    summary.push(
      "Presence removed",
    );
  }

  const remainingPresences =
    await db
      .collection("presence")
      .find({
        projectId:
          projectObjectId,
        type: "presence",
      })
      .toArray();

  const {
    nextSections:
      tagRecomputedSections,
    removedCustomTags,
  } =
    recomputeProjectTagSections(
      project.sections,
      remainingPresences,
    );

  const {
    nextSections,
    addedCustomCategories,
    removedCustomCategories,
    addedCustomUnits,
    removedCustomUnits,
  } =
    recomputeProjectPriceSections(
      tagRecomputedSections,
      remainingPresences,
    );

  return {
    deletedCount:
      presenceDeleteResult.deletedCount,
    summary,
    nextSections,
    removedCustomTags,
    addedCustomCategories,
    removedCustomCategories,
    addedCustomUnits,
    removedCustomUnits,
  };
}