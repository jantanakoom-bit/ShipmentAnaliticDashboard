export const ROLES = ["user", "moderator", "admin"];

export function normalizeRole(role) {
  return ROLES.includes(role) ? role : "user";
}

export function canViewAllSalesData(user) {
  return user?.role === "admin" || user?.role === "moderator";
}

export function canManageUsers(user) {
  return user?.role === "admin";
}

export function isDeletedRow(row = {}) {
  return row.isDeleted === true || `${row.isDeleted || ""}`.trim().toLowerCase() === "true";
}

export function ownsRow(user, row = {}) {
  if (!user?.id && !user?.username) {
    return false;
  }
  if (row.ownerUserId) {
    return row.ownerUserId === user.id;
  }
  if (row.ownerUsername) {
    return normalizeComparable(row.ownerUsername) === normalizeComparable(user.username);
  }
  return false;
}

export function canAccessSalesRow(user, row = {}) {
  if (isDeletedRow(row)) {
    return false;
  }
  return canViewAllSalesData(user) || ownsRow(user, row);
}

export function requireSalesRowAccess(user, row = {}) {
  if (!row || isDeletedRow(row)) {
    const error = new Error("Shipment not found.");
    error.status = 404;
    throw error;
  }
  if (!canAccessSalesRow(user, row)) {
    const error = new Error("Shipment access denied.");
    error.status = 403;
    throw error;
  }
}

export function scopeRowsForUser(rows = [], user) {
  if (!user?.id || !user?.role) {
    return [];
  }
  return rows.filter((row) => canAccessSalesRow(user, row));
}

function normalizeComparable(value) {
  return `${value ?? ""}`.trim().toLowerCase();
}
