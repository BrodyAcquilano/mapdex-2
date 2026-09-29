// server/utils/startPresenceCleanupJob.js
import { getDB } from "../db.js";
import { removePresenceCascade } from "./removePresenceCascade.js";

const PRESENCE_SWEEP_INTERVAL_MS = 60 * 1000;
const PRESENCE_EXPIRY_MS = 1 * 60 * 1000;

export function startPresenceCleanupJob() {
  const runCleanup = async () => {
    try {
      const db = getDB();
      const expiryDate = new Date(Date.now() - PRESENCE_EXPIRY_MS);

      const stalePresences = await db
        .collection("presence")
        .find({
          type: "presence",
          updatedAt: { $lt: expiryDate },
        })
        .toArray();

      if (stalePresences.length === 0) {
        return;
      }

      for (const presenceDoc of stalePresences) {
        try {
          if (!presenceDoc?._id || !presenceDoc?.projectId) {
            console.error(
              `[presence-cleanup] Stale presence is missing _id or projectId:`,
              presenceDoc,
            );

            if (presenceDoc?._id) {
              await db.collection("presence").deleteOne({
                _id: presenceDoc._id,
                type: "presence",
              });
            }

            continue;
          }

          const project = await db.collection("projects").findOne({
            _id: presenceDoc.projectId,
          });

          if (!project) {
            console.error(
              `[presence-cleanup] Project not found for stale presence ${presenceDoc._id}.`,
            );

            await db.collection("presence").deleteOne({
              _id: presenceDoc._id,
              type: "presence",
            });

            continue;
          }

          await removePresenceCascade(db, project, presenceDoc);
        } catch (err) {
          console.error(
            `[presence-cleanup] Failed removing stale presence ${presenceDoc?._id}:`,
            err,
          );
        }
      }
    } catch (err) {
      console.error("[presence-cleanup] Sweep failed:", err);
    }
  };

  const intervalId = setInterval(runCleanup, PRESENCE_SWEEP_INTERVAL_MS);

  runCleanup();

  return intervalId;
}