const Joi = require('joi');
const Organization = require('../models/Organization');

// Validation schema for update
const updateSchema = Joi.object({
  name: Joi.string().min(3).max(100).optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
  address: Joi.string().max(200).optional()
});

// @desc    Get organization details
// @route   GET /organizations
// @access  Owner
const getOrganization = async (req, res) => {
  try {
    const org = await Organization.findById(req.user.orgId);
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    res.json(org);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update organization details
// @route   PUT /organizations
// @access  Owner
const updateOrganization = async (req, res) => {
  const { error } = updateSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const org = await Organization.findByIdAndUpdate(req.user.orgId, req.body, { new: true, runValidators: true });
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    res.json(org);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getOrganization, updateOrganization };