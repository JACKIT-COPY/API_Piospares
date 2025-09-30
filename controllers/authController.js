const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Joi = require('joi');
const Organization = require('../models/Organization');
const Branch = require('../models/Branch');
const User = require('../models/User');

// Validation schemas
const registerSchema = Joi.object({
  orgName: Joi.string().min(3).max(100).required().messages({
    'string.min': 'Organization name must be at least 3 characters long',
    'string.max': 'Organization name must not exceed 100 characters',
    'any.required': 'Organization name is required'
  }),
  orgEmail: Joi.string().email().required().messages({
    'string.email': 'Organization email must be a valid email address',
    'any.required': 'Organization email is required'
  }),
  orgPhone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional().messages({
    'string.pattern.base': 'Organization phone must be a valid phone number'
  }),
  orgAddress: Joi.string().max(200).optional().messages({
    'string.max': 'Organization address must not exceed 200 characters'
  }),
  ownerName: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Owner name must be at least 2 characters long',
    'string.max': 'Owner name must not exceed 50 characters',
    'any.required': 'Owner name is required'
  }),
  ownerEmail: Joi.string().email().required().messages({
    'string.email': 'Owner email must be a valid email address',
    'any.required': 'Owner email is required'
  }),
  ownerPassword: Joi.string().min(8).required().messages({
    'string.min': 'Owner password must be at least 8 characters long',
    'any.required': 'Owner password is required'
  })
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email must be a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'any.required': 'Password is required'
  })
});

// @desc    Register new organization, main branch, and owner
// @route   POST /auth/register
// @access  Public
const register = async (req, res) => {
  // Validate input
  const { error } = registerSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { orgName, orgEmail, orgPhone, orgAddress, ownerName, ownerEmail, ownerPassword } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Check if org or user exists
    let org = await Organization.findOne({ email: orgEmail }).session(session);
    if (org) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Organization already exists' });
    }

    let user = await User.findOne({ email: ownerEmail }).session(session);
    if (user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create organization
    org = new Organization({ name: orgName, email: orgEmail, phone: orgPhone, address: orgAddress });
    await org.save({ session });

    // Create main branch
    const mainBranch = new Branch({ orgId: org._id, name: 'Main Branch', location: orgAddress });
    await mainBranch.save({ session });

    // Hash password and create owner
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(ownerPassword, salt);

    user = new User({
      orgId: org._id,
      branchId: mainBranch._id,
      name: ownerName,
      email: ownerEmail,
      passwordHash,
      role: 'Owner'
    });
    await user.save({ session });

    // Generate JWT
    const payload = { userId: user._id, orgId: org._id, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ token, message: 'Organization registered successfully' });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: err.message });
  }
};

// @desc    Login user and get JWT
// @route   POST /auth/login
// @access  Public
const login = async (req, res) => {
  // Validate input
  const { error } = loginSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const payload = { userId: user._id, orgId: user.orgId, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { register, login };