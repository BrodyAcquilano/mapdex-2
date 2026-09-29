// server/utils/deleteProjectSpatialDocs.js

/*
 * Removes a project's boundaries, layers and aggregates.
 *
 * These three live in their own top-level collections rather than
 * alongside the project's data items in the engine collection, so the
 * two delete paths that clean up after a project - deleting one project
 * (server/routes/projects.js) and hard-deleting an account, which walks
 * every project that user owns (server/routes/accounts.js) - would each
 * leave them behind unless they ask for them by name. Both call this so
 * there is one list of collections to keep in step rather than two.
 *
 * Every engine has these three now, so there is no engineKey check here.
 *
 * Keyed on projectId alone: unlike data items, these documents carry no
 * projectOwnerId (see the create handlers in server/routes/layers.js and
 * its siblings), and every stored projectId is an ObjectId, so there is
 * no string-vs-ObjectId variant to match the way getExportableProjectDocs.js
 * has to for data items.
 *
 * Call it after the data items and extension documents are gone and
 * before the project document itself: a boundary outliving its project
 * is invisible orphaned data, while a project outliving its boundaries
 * for a moment mid-delete is harmless.
 */

const SPATIAL_COLLECTIONS = ["boundaries", "layers", "aggregates"];

export async function deleteProjectSpatialDocs(db, projectId) {
  const summary = [];
  let deletedCount = 0;

  for (const collectionName of SPATIAL_COLLECTIONS) {
    const result = await db.collection(collectionName).deleteMany({
      projectId,
    });

    if (result.deletedCount > 0) {
      deletedCount += result.deletedCount;
      summary.push(`${result.deletedCount} ${collectionName} removed`);
    }
  }

  return { deletedCount, summary };
}
