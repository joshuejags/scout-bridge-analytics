const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendMail } = require('../utils/email');

const TOKEN_EXPIRY = '7d';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
  });

const toPublicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  emailVerified: user.emailVerified,
  createdAt: user.createdAt,
});

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }

    // Bootstrap: the very first account on a fresh install becomes admin,
    // since there is otherwise no way to ever satisfy a requireRole('admin')
    // check. Every subsequent registration defaults to 'scout' (see User
    // schema) and must be promoted by an existing admin.
    const isFirstUser = (await User.estimatedDocumentCount()) === 0;
    const user = new User({ name, email, password, role: isFirstUser ? 'admin' : 'scout' });

    const verifyToken = user.createVerifyToken();
    await user.save();

    const verifyUrl = `${CLIENT_URL}/verify-email?token=${verifyToken}`;
    await sendMail({
      to: user.email,
      subject: 'Verify your Scout Bridge Analytics account',
      text: `Welcome to Scout Bridge Analytics, ${user.name}.\n\nVerify your email address:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
    });

    const token = signToken(user);
    res.status(201).json({ token, user: toPublicUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user);
    res.json({ token, user: toPublicUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.me = async (req, res) => {
  res.json(toPublicUser(req.user));
};

exports.listUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users.map(toPublicUser));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.setUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.role = role;
    await user.save();
    res.json(toPublicUser(user));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    const tokenHash = User.hashToken(token);

    const user = await User.findOne({
      verifyTokenHash: tokenHash,
      verifyTokenExpires: { $gt: new Date() },
    }).select('+verifyTokenHash +verifyTokenExpires');

    if (!user) {
      return res.status(400).json({ error: 'Verification link is invalid or has expired' });
    }

    user.emailVerified = true;
    user.verifyTokenHash = undefined;
    user.verifyTokenExpires = undefined;
    await user.save();

    res.json({ message: 'Email verified', user: toPublicUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const user = req.user;
    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    const verifyToken = user.createVerifyToken();
    await user.save();

    const verifyUrl = `${CLIENT_URL}/verify-email?token=${verifyToken}`;
    await sendMail({
      to: user.email,
      subject: 'Verify your Scout Bridge Analytics account',
      text: `Verify your email address:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
    });

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    // Always respond 200 regardless of whether the account exists, so this
    // endpoint can't be used to enumerate registered emails. The email
    // itself (or console-fallback log — see utils/email.js) is the only
    // place that reveals whether anything actually happened.
    if (user) {
      const resetToken = user.createResetToken();
      await user.save();

      const resetUrl = `${CLIENT_URL}/reset-password?token=${resetToken}`;
      await sendMail({
        to: user.email,
        subject: 'Reset your Scout Bridge Analytics password',
        text: `A password reset was requested for this account.\n\nReset your password:\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
      });
    }

    res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const tokenHash = User.hashToken(token);

    const user = await User.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpires: { $gt: new Date() },
    }).select('+resetTokenHash +resetTokenExpires');

    if (!user) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired' });
    }

    user.password = password;
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

    res.json({ message: 'Password has been reset. You can now log in.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
