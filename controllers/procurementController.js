const Joi = require('joi');
const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');
const Product = require('../models/Product');
const User = require('../models/User');
const mongoose = require('mongoose');

// Supplier Validation Schemas
const createSupplierSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  contactEmail: Joi.string().email().allow('').optional(),
  contactPhone: Joi.string().allow('').optional(),
  address: Joi.string().allow('').optional(),
  paymentTerms: Joi.string().allow('').optional()
});

const updateSupplierSchema = Joi.object({
  name: Joi.string().min(3).max(100).optional(),
  contactEmail: Joi.string().email().allow('').optional(),
  contactPhone: Joi.string().allow('').optional(),
  address: Joi.string().allow('').optional(),
  paymentTerms: Joi.string().allow('').optional()
}).min(1);

// PO Validation Schemas
const createPOSchema = Joi.object({
  supplierId: Joi.string().required(),
  branchId: Joi.string().required(),
  items: Joi.array().items(Joi.object({
    productId: Joi.string().required(),
    quantity: Joi.number().integer().min(1).required(),
    buyingPrice: Joi.number().min(0).required()
  })).min(1).required(),
  notes: Joi.string().allow('').optional()
});

const updatePOSchema = Joi.object({
  supplierId: Joi.string().optional(),
  branchId: Joi.string().optional(),
  items: Joi.array().items(Joi.object({
    productId: Joi.string().required(),
    quantity: Joi.number().integer().min(1).required(),
    buyingPrice: Joi.number().min(0).required()
  })).min(1).optional(),
  notes: Joi.string().allow('').optional(),
  status: Joi.string().valid('pending', 'ordered', 'cancelled').optional()
}).min(1);

const receiveGoodsSchema = Joi.object({
  items: Joi.array().items(Joi.object({
    productId: Joi.string().required(),
    receivedQuantity: Joi.number().integer().min(0).required()
  })).required()
});

// @desc    Create a new supplier
// @route   POST /procurement/suppliers
// @access  Owner/Manager/SuperManager
const createSupplier = async (req, res) => {
  const { error } = createSupplierSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const supplier = new Supplier({
      orgId: req.user.orgId,
      createdBy: req.user.userId, // Changed from _id to userId to match JWT payload
      updatedBy: req.user.userId,
      ...req.body
    });
    await supplier.save();
    res.status(201).json(supplier);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update a supplier
// @route   PUT /procurement/suppliers/:id
// @access  Owner/Manager/SuperManager
const updateSupplier = async (req, res) => {
  const { error } = updateSupplierSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, orgId: req.user.orgId, isDeleted: false },
      { ...req.body, updatedBy: req.user.userId },
      { new: true, runValidators: true }
    );
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json(supplier);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Delete a supplier (soft delete)
// @route   DELETE /procurement/suppliers/:id
// @access  Owner/Manager/SuperManager
const deleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, orgId: req.user.orgId, isDeleted: false },
      { isDeleted: true, updatedBy: req.user.userId },
      { new: true }
    );
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json({ message: 'Supplier deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    List suppliers for organization
// @route   GET /procurement/suppliers
// @access  Owner/Manager/Cashier/SuperManager
const listSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find({ orgId: req.user.orgId, isDeleted: false }).lean();
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Create a new purchase order
// @route   POST /procurement/purchase-orders
// @access  Owner/Manager/SuperManager
const createPO = async (req, res) => {
  const { error } = createPOSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    // Fetch user to get branchIds
    const user = await User.findById(req.user.userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Verify branch access
    const hasBranchAccess = user.role === 'Owner' || (user.branchIds && user.branchIds.some(bId => bId.toString() === req.body.branchId));
    if (!hasBranchAccess) return res.status(403).json({ message: 'Branch not accessible' });

    // Verify supplier exists
    const supplier = await Supplier.findOne({ _id: req.body.supplierId, orgId: req.user.orgId, isDeleted: false });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });

    // Verify products exist
    for (const item of req.body.items) {
      const product = await Product.findOne({ _id: item.productId, orgId: req.user.orgId });
      if (!product) return res.status(404).json({ message: `Product ${item.productId} not found` });
    }

    const totalCost = req.body.items.reduce((sum, item) => sum + item.quantity * item.buyingPrice, 0);
    const po = new PurchaseOrder({
      orgId: req.user.orgId,
      createdBy: req.user.userId,
      updatedBy: req.user.userId,
      totalCost,
      ...req.body
    });
    await po.save();
    res.status(201).json(po);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update a purchase order
// @route   PUT /procurement/purchase-orders/:id
// @access  Owner/Manager/SuperManager
const updatePO = async (req, res) => {
  const { error } = updatePOSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, orgId: req.user.orgId, isDeleted: false });
    if (!po) return res.status(404).json({ message: 'Purchase Order not found' });
    if (po.status === 'received') return res.status(400).json({ message: 'Cannot update received PO' });

    if (req.body.items) {
      for (const item of req.body.items) {
        const product = await Product.findOne({ _id: item.productId, orgId: req.user.orgId });
        if (!product) return res.status(404).json({ message: `Product ${item.productId} not found` });
      }
      req.body.totalCost = req.body.items.reduce((sum, item) => sum + item.quantity * item.buyingPrice, 0);
    }

    const updatedPO = await PurchaseOrder.findOneAndUpdate(
      { _id: req.params.id, orgId: req.user.orgId },
      { ...req.body, updatedBy: req.user.userId },
      { new: true, runValidators: true }
    );
    res.json(updatedPO);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Delete a purchase order (soft delete)
// @route   DELETE /procurement/purchase-orders/:id
// @access  Owner/Manager/SuperManager
const deletePO = async (req, res) => {
  try {
    const po = await PurchaseOrder.findOneAndUpdate(
      { _id: req.params.id, orgId: req.user.orgId, isDeleted: false },
      { isDeleted: true, updatedBy: req.user.userId },
      { new: true }
    );
    if (!po) return res.status(404).json({ message: 'Purchase Order not found' });
    res.json({ message: 'Purchase Order deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    List purchase orders for organization
// @route   GET /procurement/purchase-orders
// @access  Owner/Manager/Cashier/SuperManager
const listPOs = async (req, res) => {
  try {
    const { supplierId, status, branchId } = req.query;
    const query = { orgId: req.user.orgId, isDeleted: false };
    if (supplierId) query.supplierId = supplierId;
    if (status) query.status = status;
    if (branchId) {
      const user = await User.findById(req.user.userId).lean();
      if (!user) return res.status(404).json({ message: 'User not found' });
      const hasBranchAccess = user.role === 'Owner' || (user.branchIds && user.branchIds.some(bId => bId.toString() === branchId));
      if (!hasBranchAccess) return res.status(403).json({ message: 'Branch not accessible' });
      query.branchId = branchId;
    }
    const pos = await PurchaseOrder.find(query).populate('supplierId', 'name').lean();
    res.json(pos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Receive goods for a purchase order
// @route   POST /procurement/purchase-orders/:id/receive
// @access  Owner/Manager/SuperManager
const receiveGoods = async (req, res) => {
  const { error } = receiveGoodsSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const po = await PurchaseOrder.findOne({ _id: req.params.id, orgId: req.user.orgId, isDeleted: false }).session(session);
    if (!po) return res.status(404).json({ message: 'Purchase Order not found' });
    if (po.status === 'received' || po.status === 'cancelled') return res.status(400).json({ message: 'Invalid status for receiving' });

    let fullyReceived = true;
    for (const receivedItem of req.body.items) {
      const poItem = po.items.find(item => item.productId.toString() === receivedItem.productId);
      if (!poItem) throw new Error(`Item ${receivedItem.productId} not found in PO`);
      if (receivedItem.receivedQuantity > poItem.quantity) throw new Error(`Received quantity exceeds ordered for ${receivedItem.productId}`);
      const increment = receivedItem.receivedQuantity - poItem.receivedQuantity;
      if (increment < 0) throw new Error('Cannot reduce received quantity');
      poItem.receivedQuantity = receivedItem.receivedQuantity;
      if (poItem.receivedQuantity < poItem.quantity) fullyReceived = false;

      //TODO : Ensure we are correctly updating inventory for the correct branch

      if (increment > 0) {
        await Product.findOneAndUpdate(
          { _id: poItem.productId, orgId: req.user.orgId, branchId: po.branchId },
          { $inc: { stock: increment }, $set: { buyingPrice: poItem.buyingPrice } },
          { session }
        );
      }
    }

    po.status = fullyReceived ? 'received' : 'ordered';
    po.updatedBy = req.user.userId;
    await po.save({ session });

    await session.commitTransaction();
    res.json(po);
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

module.exports = {
  createSupplier, updateSupplier, deleteSupplier, listSuppliers,
  createPO, updatePO, deletePO, listPOs, receiveGoods
};