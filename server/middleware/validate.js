const { validationResult } = require('express-validator');

/**
 * Runs after an express-validator check chain; responds 400 with the first
 * validation error if any checks failed, otherwise passes through.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  }
  next();
};

module.exports = validate;
