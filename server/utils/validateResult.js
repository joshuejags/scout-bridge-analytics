function validateAnalysisResult(result) {
  if (!result || typeof result !== 'object') return { valid: false, errors: ['result must be an object'] };
  if (!Array.isArray(result.playerData)) return { valid: false, errors: ['playerData must be an array'] };
  if (!Array.isArray(result.actions)) return { valid: false, errors: ['actions must be an array'] };
  // basic per-player check
  for (const p of result.playerData) {
    if (!('trackId' in p)) return { valid: false, errors: ['each playerData entry must have trackId'] };
  }
  return { valid: true };
}

module.exports = { validateAnalysisResult };
