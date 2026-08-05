const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ['admin', 'scout', 'team', 'player'], default: 'scout' },

    emailVerified: { type: Boolean, default: false },
    // Only the SHA-256 hash of each token is stored, matching how the
    // password itself is never stored in plaintext — a database leak alone
    // must not be enough to reset an account or forge a verified email.
    verifyTokenHash: { type: String, select: false },
    verifyTokenExpires: { type: Date, select: false },
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Generates a random token, stores only its hash + expiry on the document
 * (caller must still .save()), and returns the raw token to send to the
 * user — this is the one and only time the raw value exists outside the
 * user's inbox.
 */
userSchema.methods.createVerifyToken = function createVerifyToken() {
  const token = crypto.randomBytes(32).toString('hex');
  this.verifyTokenHash = hashToken(token);
  this.verifyTokenExpires = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
  return token;
};

userSchema.methods.createResetToken = function createResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  this.resetTokenHash = hashToken(token);
  this.resetTokenExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  return token;
};

userSchema.statics.hashToken = hashToken;

module.exports = mongoose.model('User', userSchema);
