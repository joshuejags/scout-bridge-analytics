const DEFAULT_JWT_SECRET = 'development-jwt-secret-not-for-production';

let warned = false;

const getJwtSecret = () => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (!warned) {
    warned = true;
    console.warn('[auth] JWT_SECRET not configured; using a local development fallback secret.');
  }
  return DEFAULT_JWT_SECRET;
};

module.exports = { getJwtSecret };
