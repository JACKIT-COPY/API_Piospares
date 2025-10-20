const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Joi = require('joi');
const Organization = require('../models/Organization');
const Branch = require('../models/Branch');
const User = require('../models/User');

// Validation Schemas
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
    // Check for existing organization or user
    const orgExists = await Organization.findOne({ email: orgEmail });
    if (orgExists) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Organization already exists' });
    }

    const userExists = await User.findOne({ email: ownerEmail });
    if (userExists) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create organization
    const org = new Organization({ name: orgName, email: orgEmail, phone: orgPhone, address: orgAddress });
    await org.save({ session });

    // Create main branch
    const mainBranch = new Branch({ orgId: org._id, name: 'Main Branch', location: orgAddress });
    await mainBranch.save({ session });

    // Hash password and create owner
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(ownerPassword, salt);

    const user = new User({
      orgId: org._id,
      branchIds: [mainBranch._id], // Assign main branch to owner
      name: ownerName,
      email: ownerEmail,
      passwordHash,
      role: 'Owner'
    });
    await user.save({ session });

    // Generate JWT
    const payload = { userId: user._id, orgId: org._id, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Construct response
    const userResponse = {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      orgId: user.orgId.toString(),
      orgName: org.name,
      branches: [{ branchId: mainBranch._id.toString(), branchName: mainBranch.name }]
    };

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ token, user: userResponse, message: 'Organization registered successfully' });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: err.message });
  }
};

// @desc    Login user and get JWT with user details
// @route   POST /auth/login
// @access  Public
const login = async (req, res) => {
  // Validate input
  const { error } = loginSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { email, password } = req.body;

  try {
    // Find user
    const user = await User.findOne({ email }).select('+passwordHash').lean();
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    // Fetch organization
    const organization = await Organization.findById(user.orgId).lean();
    if (!organization) return res.status(404).json({ message: 'Organization not found' });

    // Fetch branches based on role
    let branchDetails = [];
    if (user.role === 'Owner') {
      // Owners get all branches in the organization
      const branches = await Branch.find({ orgId: user.orgId }).lean();
      branchDetails = branches.map(branch => ({
        branchId: branch._id.toString(),
        branchName: branch.name
      }));
    } else if (user.branchIds && user.branchIds.length > 0) {
      // Managers and Cashiers get only their assigned branches
      const branches = await Branch.find({ _id: { $in: user.branchIds } }).lean();
      branchDetails = branches.map(branch => ({
        branchId: branch._id.toString(),
        branchName: branch.name
      }));
    }

    // Generate JWT
    const payload = { userId: user._id, orgId: user.orgId, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Construct response
    const userResponse = {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      orgId: user.orgId.toString(),
      orgName: organization.name,
      branches: branchDetails
    };

    res.json({ token, user: userResponse });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
// In authController.js
const verifyToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    jwt.verify(token, process.env.JWT_SECRET); // Throws if invalid
    res.status(200).json({ message: 'Token valid' });
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};
module.exports = { register, login, verifyToken };
