const bcrypt = require('bcryptjs');
const Joi = require('joi');
const User = require('../models/User');
const Branch = require('../models/Branch');

// Validation schema for invite
const inviteSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('Manager', 'Cashier').required(),
  branchId: Joi.string().optional() // Validate as ObjectId later if provided
});

// @desc    Invite/add new user
// @route   POST /users/invite
// @access  Owner/Manager
const inviteUser = async (req, res) => {
  const { error } = inviteSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { name, email, password, role, branchId } = req.body;

  try {
    // Check if user exists
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User already exists' });

    // Validate branchId if provided
    if (branchId) {
      const branch = await Branch.findById(branchId);
      if (!branch || branch.orgId.toString() !== req.user.orgId.toString()) {
        return res.status(400).json({ message: 'Invalid branch' });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    user = new User({
      orgId: req.user.orgId,
      branchId: branchId || null,
      name,
      email,
      passwordHash,
      role
    });
    await user.save();

    // In production, send email with credentials; here, return user details (omit password)
    const { passwordHash: _, ...userData } = user.toObject();
    res.status(201).json(userData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    List users for organization
// @route   GET /users
// @access  Owner/Manager
const listUsers = async (req, res) => {
  try {
    const users = await User.find({ orgId: req.user.orgId }).select('-passwordHash');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { inviteUser, listUsers };