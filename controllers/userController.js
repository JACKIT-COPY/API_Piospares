const bcrypt = require('bcryptjs');
const Joi = require('joi');
const User = require('../models/User');
const Branch = require('../models/Branch');

// Validation schema for user invitation and update
const userSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(8).optional(),
  role: Joi.string().valid('SuperManager', 'Manager', 'Cashier').optional(),
  branchIds: Joi.array().items(Joi.string()).optional(),
  status: Joi.string().valid('Active', 'On Leave', 'Inactive').optional()
});

// @desc    Invite/add new user
// @route   POST /users/invite
// @access  Owner/Manager
const inviteUser = async (req, res) => {
  const { error } = userSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { name, email, password, role, branchIds, status } = req.body;

  try {
    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    // Enforce single branch for Managers and Cashiers
    if (['Manager', 'Cashier'].includes(role) && branchIds?.length > 1) {
      return res.status(400).json({ message: `${role}s can only be assigned to a single branch` });
    }
    // Require at least one branch
    if (!branchIds || branchIds.length === 0) {
      return res.status(400).json({ message: 'At least one branch must be assigned' });
    }

    // Validate branchIds
    const branches = await Branch.find({ _id: { $in: branchIds }, orgId: req.user.orgId }).lean();
    if (branches.length !== branchIds.length) {
      return res.status(400).json({ message: 'One or more branch IDs are invalid' });
    }
    const validatedBranchIds = branches.map(branch => branch._id.toString());

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
      role,
      status: status || 'Active'
    });
    await user.save();

    // Response without passwordHash
    const userResponse = {
      _id: user._id.toString(),
      orgId: user.orgId.toString(),
      branchIds: user.branchIds.map(id => id.toString()),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status
    };

    res.status(201).json(userResponse);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update a user
// @route   PUT /users/:id
// @access  Owner/Manager
const updateUser = async (req, res) => {
  const { error } = userSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const updateData = { ...req.body };

    if (updateData.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(updateData.password, salt);
      delete updateData.password;
    }

    if (updateData.branchIds) {
      const branches = await Branch.find({ _id: { $in: updateData.branchIds }, orgId: req.user.orgId }).lean();
      if (branches.length !== updateData.branchIds.length) {
        return res.status(400).json({ message: 'One or more branch IDs are invalid' });
      }
      updateData.branchIds = branches.map(branch => branch._id);

      // Check role for branch limit
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      const roleToCheck = updateData.role || user.role; // Use updated role if provided, else current role
      if (['Manager', 'Cashier'].includes(roleToCheck) && updateData.branchIds.length > 1) {
        return res.status(400).json({ message: `${roleToCheck}s can only be assigned to a single branch` });
      }
      // Require at least one branch
      if (updateData.branchIds.length === 0) {
        return res.status(400).json({ message: 'At least one branch must be assigned' });
      }
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: req.params.id, orgId: req.user.orgId },
      updateData,
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!updatedUser) return res.status(404).json({ message: 'User not found' });

    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    List users for organization
// @route   GET /users
// @access  Owner/Manager
const listUsers = async (req, res) => {
  try {
    const { branchId } = req.query;
    const query = { orgId: req.user.orgId };
    if (branchId) query.branchIds = branchId;
    const users = await User.find(query).select('-passwordHash').lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { inviteUser, listUsers, updateUser };