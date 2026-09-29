// server/utils/dataItemPermissions.js

export function getDataItemUserRole(dataItem, authUserId, access) {
  const canEditAny = access?.isAdmin === true;

  const isCreatedByUser =
    String(dataItem?.createdByUserId || "") === String(authUserId);

  return canEditAny || isCreatedByUser ? "editor" : "viewer";
}

export function getPresenceUserRole(dataItem, authUserId) {
  const isCreatedByUser =
    String(dataItem?.createdByUserId || "") === String(authUserId);

  return isCreatedByUser ? "editor" : "viewer";
}