const bcrypt = require('bcryptjs');
const Joi = require('joi');
const User = require('../models/User');
const Branch = require('../models/Branch');

// Validation schema for user invitation
const inviteSchema = Joi.object({
  name: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name must not exceed 50 characters',
    'any.required': 'Name is required'
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Email must be a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'any.required': 'Password is required'
  }),
  role: Joi.string().valid('Manager', 'Cashier').required().messages({
    'any.only': 'Role must be either Manager or Cashier',
    'any.required': 'Role is required'
  }),
  branchIds: Joi.array().items(Joi.string()).optional().messages({
    'array.base': 'Branch IDs must be an array of strings'
  })
});

// @desc    Invite/add new user
// @route   POST /users/invite
// @access  Owner/Manager
const inviteUser = async (req, res) => {
  const { error } = inviteSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { name, email, password, role, branchIds } = req.body;

  try {
    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    // Enforce single branch for Cashiers
    if (role === 'Cashier' && branchIds && branchIds.length > 1) {
      return res.status(400).json({ message: 'Cashiers can only be assigned to a single branch' });
    }

    // Validate branchIds if provided
    let validatedBranchIds = branchIds || [];
    if (branchIds && branchIds.length > 0) {
      const branches = await Branch.find({ _id: { $in: branchIds }, orgId: req.user.orgId }).lean();
      if (branches.length !== branchIds.length) {
        return res.status(400).json({ message: 'One or more branch IDs are invalid' });
      }
      validatedBranchIds = branches.map(branch => branch._id.toString());
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({
      orgId: req.user.orgId,
      branchIds: validatedBranchIds,
      name,
      email,
      passwordHash,
      role
    });
    await user.save();

    // Construct response (omit passwordHash)
    const userResponse = {
      _id: user._id.toString(),
      orgId: user.orgId.toString(),
      branchIds: user.branchIds.map(id => id.toString()),
      name: user.name,
      email: user.email,
      role: user.role
    };

    res.status(201).json(userResponse);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    List users for organization
// @route   GET /users
// @access  Owner/Manager
const listUsers = async (req, res) => {
  try {
    const users = await User.find({ orgId: req.user.orgId }).select('-passwordHash').lean();
    const usersResponse = users.map(user => ({
      _id: user._id.toString(),
      orgId: user.orgId.toString(),
      branchIds: user.branchIds.map(id => id.toString()),
      name: user.name,
      email: user.email,
      role: user.role
    }));
    res.json(usersResponse);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { inviteUser, listUsers };