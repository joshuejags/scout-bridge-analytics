/**
 * Returns a new object containing only `keys` from `obj`, skipping any key
 * not present in `obj` at all. Used to build Mongoose create/update
 * payloads from req.body explicitly, instead of passing the whole body
 * through — an unlisted field (however the client sends it) never reaches
 * the model.
 */
function pick(obj, keys) {
  const result = {};
  for (const key of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

module.exports = { pick };
