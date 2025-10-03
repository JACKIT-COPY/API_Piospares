const Joi = require('joi');
const Product = require('../models/Product');

// Validation schema for product creation
const createSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  categoryId: Joi.string().required(),
  price: Joi.number().positive().required(),
  stock: Joi.number().integer().min(0).required(),
  minStock: Joi.number().integer().min(0).required(),
  branchId: Joi.string().required(),
  description: Joi.string().max(500).optional()
});

// Validation schema for product update
const updateSchema = Joi.object({
  name: Joi.string().min(3).max(100).optional(),
  categoryId: Joi.string().optional(),
  price: Joi.number().positive().optional(),
  stock: Joi.number().integer().min(0).optional(),
  minStock: Joi.number().integer().min(0).optional(),
  description: Joi.string().max(500).optional()
});

// @desc    Create a new product
// @route   POST /products
// @access  Owner/Manager/SuperManager
const createProduct = async (req, res) => {
  const { error } = createSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const product = new Product({
      orgId: req.user.orgId,
      ...req.body
    });
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update a product
// @route   PUT /products/:id
// @access  Owner/Manager/SuperManager
const updateProduct = async (req, res) => {
  const { error } = updateSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, orgId: req.user.orgId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Delete a product
// @route   DELETE /products/:id
// @access  Owner/Manager/SuperManager
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.id, orgId: req.user.orgId });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    List products for organization
// @route   GET /products
// @access  Owner/Manager/Cashier/SuperManager
const listProducts = async (req, res) => {
  try {
    const { branchId, categoryId } = req.query;
    const query = { orgId: req.user.orgId };
    if (branchId) query.branchId = branchId;
    if (categoryId) query.categoryId = categoryId;
    const products = await Product.find(query).lean();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createProduct, listProducts, updateProduct, deleteProduct };