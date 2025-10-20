const Joi = require('joi');
const Branch = require('../models/Branch');

// Validation schema for branch creation
const createSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  location: Joi.string().max(200).optional()
});

// Validation schema for branch update
const updateSchema = Joi.object({
  name: Joi.string().min(3).max(100).optional(),
  location: Joi.string().max(200).optional()
});

// @desc    Create a new branch
// @route   POST /branches
// @access  Owner/Manager
const createBranch = async (req, res) => {
  const { error } = createSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const branch = new Branch({
      orgId: req.user.orgId,
      ...req.body
    });
    await branch.save();
    res.status(201).json(branch);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update a branch
// @route   PUT /branches/:id
// @access  Owner/Manager
const updateBranch = async (req, res) => {
  const { error } = updateSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const branch = await Branch.findOneAndUpdate(
      { _id: req.params.id, orgId: req.user.orgId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!branch) return res.status(404).json({ message: 'Branch not found' });
    res.json(branch);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    List branches for organization
// @route   GET /branches
// @access  Owner/Manager
const listBranches = async (req, res) => {
  try {
    const branches = await Branch.find({ orgId: req.user.orgId }).lean();
    res.json(branches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createBranch, listBranches, updateBranch };