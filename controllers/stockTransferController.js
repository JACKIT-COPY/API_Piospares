const StockTransferRequest = require('../models/StockTransferRequest');
const Product = require('../models/Product');
const Branch = require('../models/Branch');
const ActivityLog = require('../models/ActivityLog');
const Joi = require('joi');

// Validation schemas
const createTransferSchema = Joi.object({
  sourceBranchId: Joi.string().required(),
  destinationBranchId: Joi.string().required(),
  products: Joi.array().items(
    Joi.object({
      productId: Joi.string().required(),
      quantityRequested: Joi.number().min(1).required()
    })
  ).min(1).required(),
  reason: Joi.string().allow('').optional()
});

const approveTransferSchema = Joi.object({
  approvalNotes: Joi.string().allow('').optional()
});

const rejectTransferSchema = Joi.object({
  approvalNotes: Joi.string().allow('').optional()
});

// Helper function to log activity
const logActivity = async (actor, actorRole, orgId, action, target, details) => {
  try {
    await ActivityLog.create({
      actor,
      actorRole,
      orgId,
      action,
      target,
      details,
      ip: ''
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
};

// Helper to add history entry
const addHistoryEntry = (request, action, userId, userName, role, comment = '') => {
  request.history.push({
    action,
    by: { userId, name: userName, role },
    comment,
    timestamp: new Date()
  });
};

// List transfer requests
exports.listTransfers = async (req, res) => {
  try {
    const { branchId, status, productId, startDate, endDate, requestedBy } = req.query;
    const orgId = req.user.orgId;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const query = { orgId, isDeleted: false };

    // Role-based filtering
    if (!['Owner', 'SuperManager', 'Manager'].includes(userRole)) {
      // Non-managers can only see their own requests and transfers to/from their branch
      const userBranches = req.user.branchIds || [];
      query.$or = [
        { 'requestedBy.userId': userId },
        { sourceBranchId: { $in: userBranches } },
        { destinationBranchId: { $in: userBranches } }
      ];
    }

    if (branchId) {
      query.$or = [
        { sourceBranchId: branchId },
        { destinationBranchId: branchId }
      ];
    }

    if (status) query.status = status;
    if (requestedBy) query['requestedBy.userId'] = requestedBy;

    if (startDate || endDate) {
      query.requestedAt = {};
      if (startDate) query.requestedAt.$gte = new Date(startDate);
      if (endDate) query.requestedAt.$lte = new Date(endDate);
    }

    const transfers = await StockTransferRequest.find(query)
      .populate('sourceBranchId', 'name')
      .populate('destinationBranchId', 'name')
      .sort({ requestedAt: -1 })
      .lean();

    res.json(transfers);
  } catch (err) {
    console.error('List transfers error:', err);
    res.status(500).json({ message: 'Failed to list transfers', error: err.message });
  }
};

// Get transfer detail
exports.getTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.orgId;

    const transfer = await StockTransferRequest.findOne({ _id: id, orgId, isDeleted: false })
      .populate('sourceBranchId', 'name location')
      .populate('destinationBranchId', 'name location');

    if (!transfer) return res.status(404).json({ message: 'Transfer request not found' });

    res.json(transfer);
  } catch (err) {
    console.error('Get transfer error:', err);
    res.status(500).json({ message: 'Failed to get transfer', error: err.message });
  }
};

// Create transfer request
exports.createTransfer = async (req, res) => {
  try {
    const { error, value } = createTransferSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { sourceBranchId, destinationBranchId, products, reason } = value;
    const orgId = req.user.orgId;
    const userId = req.user.userId;
    let userName = req.user.name;
    const userRole = req.user.role;

    if (!userName) {
      const userDoc = await require('../models/User').findById(userId).lean();
      userName = userDoc ? userDoc.name : 'Unknown User';
    }

    // Validate branches are different
    if (sourceBranchId === destinationBranchId) {
      return res.status(400).json({ message: 'Source and destination branches must be different' });
    }

    // Validate branches exist and belong to org
    const [sourceBranch, destBranch] = await Promise.all([
      Branch.findOne({ _id: sourceBranchId, orgId }),
      Branch.findOne({ _id: destinationBranchId, orgId })
    ]);

    if (!sourceBranch || !destBranch) {
      return res.status(404).json({ message: 'One or both branches not found' });
    }

    // Validate user has access to source branch (if not manager+)
    if (!['Owner', 'SuperManager', 'Manager'].includes(userRole)) {
      const userBranches = req.user.branchIds || [];
      if (!userBranches.includes(sourceBranchId)) {
        return res.status(403).json({ message: 'You do not have access to the source branch' });
      }
    }

    // Fetch and validate products
    const productIds = products.map(p => p.productId);
    const dbProducts = await Product.find({
      _id: { $in: productIds },
      orgId,
      branchId: sourceBranchId
    });

    if (dbProducts.length !== productIds.length) {
      return res.status(400).json({ message: 'One or more products not found in source branch' });
    }

    // Check stock availability
    const productMap = {};
    dbProducts.forEach(p => {
      productMap[p._id.toString()] = p;
    });

    for (const product of products) {
      const dbProduct = productMap[product.productId];
      if (!dbProduct) {
        return res.status(400).json({ message: `Product ${product.productId} not found` });
      }
      if (dbProduct.stock < product.quantityRequested) {
        return res.status(400).json({
          message: `Insufficient stock for ${dbProduct.name}. Available: ${dbProduct.stock}, Requested: ${product.quantityRequested}`
        });
      }
    }

    // Build products array with additional info
    const productsData = products.map(p => {
      const dbProduct = productMap[p.productId];
      return {
        productId: p.productId,
        name: dbProduct.name,
        categoryId: dbProduct.categoryId,
        quantityRequested: p.quantityRequested,
        quantityApproved: 0,
        unitPrice: dbProduct.price,
        buyingPrice: dbProduct.buyingPrice
      };
    });

    // Create transfer request
    const transfer = new StockTransferRequest({
      orgId,
      sourceBranchId,
      destinationBranchId,
      requestedBy: { userId, name: userName, role: userRole },
      products: productsData,
      reason,
      history: [{
        action: 'Requested',
        by: { userId, name: userName, role: userRole },
        comment: reason || '',
        timestamp: new Date()
      }]
    });

    await transfer.save();

    // Log activity
    await logActivity(
      userName,
      userRole,
      orgId,
      'StockTransferRequested',
      'StockTransferRequest',
      { transferId: transfer._id, branch: sourceBranch.name, productCount: products.length }
    );

    await transfer.populate([
      { path: 'sourceBranchId', select: 'name' },
      { path: 'destinationBranchId', select: 'name' }
    ]);
    res.status(201).json(transfer);
  } catch (err) {
    console.error('Create transfer error:', err);
    res.status(500).json({ message: 'Failed to create transfer', error: err.message });
  }
};

// Approve transfer
exports.approveTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = approveTransferSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { approvalNotes } = value;
    const orgId = req.user.orgId;
    const userId = req.user.userId;
    let userName = req.user.name;
    const userRole = req.user.role;

    if (!userName) {
      const userDoc = await require('../models/User').findById(userId).lean();
      userName = userDoc ? userDoc.name : 'Unknown User';
    }

    // Only managers+ can approve
    if (!['Owner', 'SuperManager', 'Manager'].includes(userRole)) {
      return res.status(403).json({ message: 'Only managers can approve transfers' });
    }

    const transfer = await StockTransferRequest.findOne({ _id: id, orgId, isDeleted: false });
    if (!transfer) return res.status(404).json({ message: 'Transfer request not found' });

    if (transfer.status !== 'Pending') {
      return res.status(400).json({ message: `Cannot approve request with status: ${transfer.status}` });
    }

    // Update quantities approved (for now, approve all)
    transfer.products.forEach(p => {
      p.quantityApproved = p.quantityRequested;
    });

    transfer.status = 'Approved';
    transfer.approvedAt = new Date();
    transfer.approvedBy = { userId, name: userName, role: userRole };
    transfer.approvalNotes = approvalNotes;
    addHistoryEntry(transfer, 'Approved', userId, userName, userRole, approvalNotes);

    await transfer.save();

    // Log activity
    await logActivity(
      userName,
      userRole,
      orgId,
      'StockTransferApproved',
      'StockTransferRequest',
      { transferId: transfer._id, productCount: transfer.products.length }
    );

    await transfer.populate([
      { path: 'sourceBranchId', select: 'name' },
      { path: 'destinationBranchId', select: 'name' }
    ]);
    res.json(transfer);
  } catch (err) {
    console.error('Approve transfer error:', err);
    res.status(500).json({ message: 'Failed to approve transfer', error: err.message });
  }
};

// Reject transfer
exports.rejectTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = rejectTransferSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { approvalNotes } = value;
    const orgId = req.user.orgId;
    const userId = req.user.userId;
    let userName = req.user.name;
    const userRole = req.user.role;

    if (!userName) {
      const userDoc = await require('../models/User').findById(userId).lean();
      userName = userDoc ? userDoc.name : 'Unknown User';
    }

    // Only managers+ can reject
    if (!['Owner', 'SuperManager', 'Manager'].includes(userRole)) {
      return res.status(403).json({ message: 'Only managers can reject transfers' });
    }

    const transfer = await StockTransferRequest.findOne({ _id: id, orgId, isDeleted: false });
    if (!transfer) return res.status(404).json({ message: 'Transfer request not found' });

    if (transfer.status !== 'Pending') {
      return res.status(400).json({ message: `Cannot reject request with status: ${transfer.status}` });
    }

    transfer.status = 'Rejected';
    transfer.approvedBy = { userId, name: userName, role: userRole };
    transfer.approvalNotes = approvalNotes;
    addHistoryEntry(transfer, 'Rejected', userId, userName, userRole, approvalNotes);

    await transfer.save();

    // Log activity
    await logActivity(
      userName,
      userRole,
      orgId,
      'StockTransferRejected',
      'StockTransferRequest',
      { transferId: transfer._id, reason: approvalNotes }
    );

    await transfer.populate([
      { path: 'sourceBranchId', select: 'name' },
      { path: 'destinationBranchId', select: 'name' }
    ]);
    res.json(transfer);
  } catch (err) {
    console.error('Reject transfer error:', err);
    res.status(500).json({ message: 'Failed to reject transfer', error: err.message });
  }
};

// Complete transfer (move stock)
exports.completeTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.orgId;
    const userId = req.user.userId;
    let userName = req.user.name;
    const userRole = req.user.role;

    if (!userName) {
      const userDoc = await require('../models/User').findById(userId).lean();
      userName = userDoc ? userDoc.name : 'Unknown User';
    }

    // Only managers+ can complete
    if (!['Owner', 'SuperManager', 'Manager'].includes(userRole)) {
      return res.status(403).json({ message: 'Only managers can complete transfers' });
    }

    const transfer = await StockTransferRequest.findOne({ _id: id, orgId, isDeleted: false });
    if (!transfer) return res.status(404).json({ message: 'Transfer request not found' });

    if (transfer.status !== 'Approved') {
      return res.status(400).json({ message: 'Only approved transfers can be completed' });
    }

    // Update product stock
    for (const product of transfer.products) {
      const qty = product.quantityApproved;

      // Decrement source branch
      await Product.findByIdAndUpdate(
        product.productId,
        { $inc: { stock: -qty } },
        { new: true }
      );

      // Increment destination branch product (or create if doesn't exist)
      const destProduct = await Product.findOne({
        orgId,
        branchId: transfer.destinationBranchId,
        categoryId: product.categoryId,
        name: product.name
      });

      if (destProduct) {
        await Product.findByIdAndUpdate(
          destProduct._id,
          { $inc: { stock: qty } }
        );
      } else {
        // Create new product in destination branch
        await Product.create({
          orgId,
          branchId: transfer.destinationBranchId,
          categoryId: product.categoryId,
          name: product.name,
          price: product.unitPrice,
          buyingPrice: product.buyingPrice,
          stock: qty,
          minStock: 0,
          createdBy: userId
        });
      }
    }

    transfer.status = 'Completed';
    transfer.completedAt = new Date();
    addHistoryEntry(transfer, 'Completed', userId, userName, userRole, 'Stock transferred successfully');

    await transfer.save();

    // Log activity
    await logActivity(
      userName,
      userRole,
      orgId,
      'StockTransferCompleted',
      'StockTransferRequest',
      { transferId: transfer._id, totalQuantity: transfer.products.reduce((sum, p) => sum + p.quantityApproved, 0) }
    );

    await transfer.populate([
      { path: 'sourceBranchId', select: 'name' },
      { path: 'destinationBranchId', select: 'name' }
    ]);
    res.json(transfer);
  } catch (err) {
    console.error('Complete transfer error:', err);
    res.status(500).json({ message: 'Failed to complete transfer', error: err.message });
  }
};

// Cancel transfer
exports.cancelTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.orgId;
    const userId = req.user.userId;
    let userName = req.user.name;
    const userRole = req.user.role;

    if (!userName) {
      const userDoc = await require('../models/User').findById(userId).lean();
      userName = userDoc ? userDoc.name : 'Unknown User';
    }

    const transfer = await StockTransferRequest.findOne({ _id: id, orgId, isDeleted: false });
    if (!transfer) return res.status(404).json({ message: 'Transfer request not found' });

    // Can only cancel pending requests, or own pending/approved
    if (transfer.status === 'Completed' || transfer.status === 'Rejected' || transfer.status === 'Cancelled') {
      return res.status(400).json({ message: `Cannot cancel request with status: ${transfer.status}` });
    }

    // Non-managers can only cancel their own
    if (!['Owner', 'SuperManager', 'Manager'].includes(userRole)) {
      if (transfer.requestedBy.userId.toString() !== userId.toString()) {
        return res.status(403).json({ message: 'You can only cancel your own requests' });
      }
    }

    transfer.status = 'Cancelled';
    addHistoryEntry(transfer, 'Cancelled', userId, userName, userRole, 'Cancelled by user');

    await transfer.save();

    // Log activity
    await logActivity(
      userName,
      userRole,
      orgId,
      'StockTransferCancelled',
      'StockTransferRequest',
      { transferId: transfer._id }
    );

    await transfer.populate([
      { path: 'sourceBranchId', select: 'name' },
      { path: 'destinationBranchId', select: 'name' }
    ]);
    res.json(transfer);
  } catch (err) {
    console.error('Cancel transfer error:', err);
    res.status(500).json({ message: 'Failed to cancel transfer', error: err.message });
  }
};
