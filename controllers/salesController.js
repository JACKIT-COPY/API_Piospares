const Joi = require('joi');
const Sale = require('../models/Sale');
const Product = require('../models/Product');

// Validation schema for sale creation
const createSchema = Joi.object({
  products: Joi.array().items(
    Joi.object({
      productId: Joi.string().required(),
      name: Joi.string().required(),
      price: Joi.number().positive().required(),
      quantity: Joi.number().integer().min(1).required(),
    })
  ).min(1).required(),
  discount: Joi.number().min(0).optional(),
  paymentMethod: Joi.string().valid('cash', 'mpesa', 'pending').required(),
  branchId: Joi.string().required(),
});

// Validation schema for updating sale status
const updateStatusSchema = Joi.object({
  status: Joi.string().valid('completed', 'pending').required(),
  paymentMethod: Joi.string().valid('cash', 'mpesa').when('status', { is: 'completed', then: Joi.required() }),
});

// @desc    Create a new sale
// @route   POST /sales
// @access  Owner/Manager/Cashier/SuperManager
const createSale = async (req, res) => {
  const { error } = createSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    // Ensure user is authenticated
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { products, discount, paymentMethod, branchId } = req.body;

    // Verify stock availability and branch consistency
    for (const item of products) {
      const product = await Product.findById(item.productId);
      if (!product || product.orgId.toString() !== req.user.orgId) {
        return res.status(404).json({ message: `Product ${item.name} not found` });
      }
      if (product.branchId.toString() !== branchId) {
        return res.status(400).json({ message: `Product ${item.name} does not belong to branch ${branchId}` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${item.name}` });
      }
    }

    // Calculate total
    const total = products.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const finalTotal = total - (discount || 0);

    // Create sale
    const sale = new Sale({
      orgId: req.user.orgId,
      branchId,
      userId: req.user.userId, // Use userId from JWT payload
      products,
      total: finalTotal,
      discount: discount || 0,
      paymentMethod,
      status: paymentMethod === 'pending' ? 'pending' : 'completed',
    });

    // Update stock if completed
    if (paymentMethod !== 'pending') {
      for (const item of products) {
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: -item.quantity } },
          { runValidators: true }
        );
      }
    }

    await sale.save();
    res.status(201).json(sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    List sales for organization
// @route   GET /sales
// @access  Owner/Manager/Cashier/SuperManager
const listSales = async (req, res) => {
  try {
    const { branchId, status } = req.query;
    const query = { orgId: req.user.orgId };
    if (branchId) query.branchId = branchId;
    if (status) query.status = status;
    const sales = await Sale.find(query).lean();
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update sale status
// @route   PUT /sales/:id
// @access  Owner/Manager/SuperManager
const updateSaleStatus = async (req, res) => {
  const { error } = updateStatusSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const sale = await Sale.findOne({ _id: req.params.id, orgId: req.user.orgId });
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    // If updating to completed, update stock
    if (req.body.status === 'completed' && sale.status === 'pending') {
      for (const item of sale.products) {
        const product = await Product.findById(item.productId);
        if (!product) return res.status(404).json({ message: `Product ${item.name} not found` });
        if (product.stock < item.quantity) {
          return res.status(400).json({ message: `Insufficient stock for ${item.name}` });
        }
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: -item.quantity } },
          { runValidators: true }
        );
      }
    }

    sale.status = req.body.status;
    if (req.body.status === 'completed') {
      sale.paymentMethod = req.body.paymentMethod;
    }
    await sale.save();
    res.json(sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createSale, listSales, updateSaleStatus };