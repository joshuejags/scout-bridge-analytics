const mongoose = require('mongoose');

/**
 * Validate MongoDB ObjectId
 */
const validateObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(`Invalid ID: ${id}`);
  }
  return id;
};

/**
 * Validate pagination parameters
 */
const validatePagination = (page = 1, limit = 50) => {
  const p = parseInt(page, 10);
  const l = parseInt(limit, 10);

  if (isNaN(p) || p < 1) {
    throw new Error('Page must be a positive integer');
  }

  if (isNaN(l) || l < 1 || l > 1000) {
    throw new Error('Limit must be between 1 and 1000');
  }

  return { page: p, limit: l };
};

/**
 * Validate email
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error(`Invalid email: ${email}`);
  }
  return email;
};

/**
 * Validate required field
 */
const validateRequired = (value, fieldName) => {
  if (!value || (typeof value === 'string' && !value.trim())) {
    throw new Error(`${fieldName} is required`);
  }
  return value;
};

/**
 * Validate URL
 */
const validateUrl = (url) => {
  try {
    new URL(url);
    return url;
  } catch (error) {
    throw new Error(`Invalid URL: ${url}`);
  }
};

/**
 * Validate role
 */
const validateRole = (role, validRoles = ['admin', 'scout', 'manager', 'coach', 'analyst', 'player']) => {
  if (!validRoles.includes(role)) {
    throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
  }
  return role;
};

/**
 * Sanitize string input
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') {
    return str;
  }
  return str
    .trim()
    .replace(/[<>]/g, '')
    .slice(0, 1000); // Max 1000 chars
};

/**
 * Validate date range
 */
const validateDateRange = (startDate, endDate) => {
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format');
    }

    if (start > end) {
      throw new Error('Start date must be before end date');
    }

    return { startDate: start, endDate: end };
  }

  return { startDate, endDate };
};

module.exports = {
  validateObjectId,
  validatePagination,
  validateEmail,
  validateRequired,
  validateUrl,
  validateRole,
  sanitizeString,
  validateDateRange,
};
