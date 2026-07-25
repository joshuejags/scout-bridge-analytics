/**
 * Turns a known Mongoose/MongoDB error into a clean, user-safe message —
 * particularly duplicate-key errors, whose default message leaks raw DB/
 * collection/index names (e.g. "E11000 duplicate key error collection:
 * scout-bridge-analytics.teams index: name_1 dup key: ..."). Returns null
 * for anything not recognized, so callers fall back to their existing
 * catch-all handling for truly unexpected errors rather than hiding them.
 */
function friendlyMongooseError(error) {
  if (error && error.code === 11000) {
    const field = error.keyValue ? Object.keys(error.keyValue)[0] : null;
    return field
      ? `A record with that ${field} already exists.`
      : 'A record with those values already exists.';
  }
  if (error && error.name === 'ValidationError') {
    const first = Object.values(error.errors || {})[0];
    return first ? first.message : 'Validation failed.';
  }
  return null;
}

module.exports = { friendlyMongooseError };
