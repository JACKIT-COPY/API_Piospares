const Joi = require('joi');
const Category = require('../models/Category');
const Product = require('../models/Product');

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
// @access  Owner/Manager/SuperManager
const createCategory = async (req, res) => {
  const { error } = createSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const category = new Category({
      orgId: req.user.orgId,
      createdBy: req.user._id,
      updatedBy: req.user._id,
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
// @access  Owner/Manager/SuperManager
const updateCategory = async (req, res) => {
  const { error } = updateSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, orgId: req.user.orgId, isDeleted: false },
      { ...req.body, updatedBy: req.user._id },
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
// @access  Owner/Manager/SuperManager
const deleteCategory = async (req, res) => {
  try {
    const productCount = await Product.countDocuments({ categoryId: req.params.id, isDeleted: false });
    if (productCount > 0) return res.status(400).json({ message: 'Cannot delete category with associated products' });

    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, orgId: req.user.orgId, isDeleted: false },
      { isDeleted: true, updatedBy: req.user._id },
      { new: true }
    );
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    List categories for organization
// @route   GET /categories
// @access  Owner/Manager/Cashier/SuperManager
const listCategories = async (req, res) => {
  try {
    const categories = await Category.find({ orgId: req.user.orgId, isDeleted: false }).lean();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createCategory, listCategories, updateCategory, deleteCategory };