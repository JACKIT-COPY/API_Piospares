const Joi = require('joi');
const Branch = require('../models/Branch');

// Validation schema for create
const createSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
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
      name: req.body.name,
      location: req.body.location
    });
    await branch.save();
    res.status(201).json(branch);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    List branches for organization
// @route   GET /branches
// @access  Owner/Manager
const listBranches = async (req, res) => {
  try {
    const branches = await Branch.find({ orgId: req.user.orgId });
    res.json(branches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createBranch, listBranches };