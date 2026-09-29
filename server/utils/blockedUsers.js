// server/utils/blockedUsers.js
// Helpers for enforcing block relationships when listing or loading
// projects: a blocked relationship (either direction) hides projects and
// profiles from both users, not just the one who initiated the block.

export async function getBlockedRelationshipIds(db, userId) {
  const [myDoc, blockedMeDocs] = await Promise.all([
    db
      .collection("users")
      .findOne({ _id: userId }, { projection: { blockedUsers: 1 } }),
    db
      .collection("users")
      .find({ "blockedUsers._id": userId }, { projection: { _id: 1 } })
      .toArray(),
  ]);

  const myBlockedIds = (myDoc?.blockedUsers || [])
    .map((ref) => ref?._id)
    .filter(Boolean);

  const blockedMeIds = blockedMeDocs.map((doc) => doc._id);

  return [...myBlockedIds, ...blockedMeIds];
}

export async function isBlockedRelationship(db, userIdA, userIdB) {
  const [docA, docB] = await Promise.all([
    db
      .collection("users")
      .findOne({ _id: userIdA }, { projection: { blockedUsers: 1 } }),
    db
      .collection("users")
      .findOne({ _id: userIdB }, { projection: { blockedUsers: 1 } }),
  ]);

  const aBlockedB = (docA?.blockedUsers || []).some(
    (ref) => String(ref?._id) === String(userIdB),
  );

  const bBlockedA = (docB?.blockedUsers || []).some(
    (ref) => String(ref?._id) === String(userIdA),
  );

  return aBlockedB || bBlockedA;
}
