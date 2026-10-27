const AuditLog = require('../models/AuditLog');

const SENSITIVE_KEYS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'jwt',
  'csrfToken',
  'cookie',
  'authorization',
  'secret',
  'resetToken',
  'verificationToken',
]);

/**
 * Recursively strips sensitive keys from metadata objects and arrays.
 */
function stripSensitiveKeys(obj, seen = new WeakSet()) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (seen.has(obj)) {
    return '[Circular]';
  }
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map((item) => stripSensitiveKeys(item, seen));
  }

  if (obj instanceof Date || obj instanceof RegExp || Buffer.isBuffer(obj)) {
    return obj;
  }

  const clean = {};
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(key.toLowerCase())) {
      continue;
    }
    clean[key] = stripSensitiveKeys(obj[key], seen);
  }

  return clean;
}

/**
 * Safely extracts actorId, actorRole, and IP from Express request context.
 */
function extractContext(req) {
  if (!req || typeof req !== 'object') {
    return { actorId: null, actorRole: 'anonymous', ip: null };
  }

  const actorId = req.user?._id || req.user?.id || req.admin?._id || req.admin?.id || null;
  const actorRole = req.user?.role || req.admin?.role || (req.user ? 'user' : 'anonymous');
  const ip = req.ip || req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;

  return { actorId, actorRole, ip };
}

/**
 * Central Audit Logger utility.
 * NEVER throws or crashes the main request flow.
 */
async function log({
  req = null,
  actorId = null,
  actorRole = null,
  action,
  category,
  severity = 'INFO',
  targetType = null,
  targetId = null,
  outcome = 'SUCCESS',
  ip = null,
  statusCode = null,
  metadata = {},
} = {}) {
  try {
    const ctx = extractContext(req);
    const resolvedActorId = actorId !== null ? actorId : ctx.actorId;
    const resolvedActorRole = actorRole || ctx.actorRole || 'anonymous';
    const resolvedIp = ip || ctx.ip || null;

    const sanitizedMetadata = stripSensitiveKeys(metadata);

    const logEntry = await AuditLog.create({
      actorId: resolvedActorId,
      actorRole: resolvedActorRole,
      action: action || 'UNKNOWN_ACTION',
      category: category || 'SECURITY',
      severity: severity || 'INFO',
      targetType: targetType || null,
      targetId: targetId || null,
      outcome: outcome || 'SUCCESS',
      ip: resolvedIp,
      statusCode: statusCode || (req?.res?.statusCode || null),
      metadata: sanitizedMetadata || {},
    });

    return logEntry;
  } catch (err) {
    console.error('[AuditLogger] Failed to write audit log:', err?.message || err);
    return null;
  }
}

module.exports = {
  log,
  stripSensitiveKeys,
  SENSITIVE_KEYS,
};
