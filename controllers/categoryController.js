const Joi = require('joi');
const Category = require('../models/Category');

// Validation schema for category creation
const createSchema = Joi.object({
  name: Joi.string().min(3).max(100).required()
});

// Validation schema for category update
const updateSchema = Joi.object({
  name: Joi.string().min(3).max(100).optional()
});

// @desc    Create a new category
// @route   POST /categories
// @access  Owner/Manager
const createCategory = async (req, res) => {
  const { error } = createSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const category = new Category({
      orgId: req.user.orgId,
      ...req.body
    });
    await category.save();
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update a category
// @route   PUT /categories/:id
// @access  Owner/Manager
const updateCategory = async (req, res) => {
  const { error } = updateSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, orgId: req.user.orgId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json(category);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Delete a category
// @route   DELETE /categories/:id
// @access  Owner/Manager
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findOneAndDelete({ _id: req.params.id, orgId: req.user.orgId });
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    List categories for organization
// @route   GET /categories
// @access  Owner/Manager/Cashier
const listCategories = async (req, res) => {
  try {
    const categories = await Category.find({ orgId: req.user.orgId }).lean();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createCategory, listCategories, updateCategory, deleteCategory };