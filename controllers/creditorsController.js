const mongoose = require('mongoose');
const PurchaseOrder = require('../models/PurchaseOrder');
const Supplier = require('../models/Supplier');

// ──────────────────────────────────────────────────────────────
// GET /creditors/summary
// Aggregate all unpaid/partially-paid POs grouped by supplier
// ──────────────────────────────────────────────────────────────
const getCreditorsSummary = async (req, res) => {
  try {
    const { branchId, startDate, endDate } = req.query;
    const orgId = new mongoose.Types.ObjectId(req.user.orgId);

    const match = {
      orgId,
      isDeleted: false,
      pendingAmount: { $gt: 0 }
    };

    if (branchId) match.branchId = new mongoose.Types.ObjectId(branchId);
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    const creditors = await PurchaseOrder.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$supplierId',
          totalOwed: { $sum: '$pendingAmount' },
          totalPOValue: { $sum: '$totalCost' },
          totalPaid: { $sum: '$paidAmount' },
          unpaidPOCount: { $sum: 1 },
          oldestDebt: { $min: '$createdAt' },
          newestDebt: { $max: '$createdAt' },
          purchaseOrders: {
            $push: {
              _id: '$_id',
              totalCost: '$totalCost',
              paidAmount: '$paidAmount',
              pendingAmount: '$pendingAmount',
              status: '$status',
              items: '$items',
              notes: '$notes',
              branchId: '$branchId',
              createdAt: '$createdAt'
            }
          }
        }
      },
      {
        $lookup: {
          from: 'suppliers',
          localField: '_id',
          foreignField: '_id',
          as: 'supplier'
        }
      },
      { $unwind: '$supplier' },
      {
        $project: {
          _id: 0,
          supplierId: '$_id',
          supplierName: '$supplier.name',
          supplierPhone: '$supplier.contactPhone',
          supplierEmail: '$supplier.contactEmail',
          supplierAddress: '$supplier.address',
          paymentTerms: '$supplier.paymentTerms',
          totalOwed: 1,
          totalPOValue: 1,
          totalPaid: 1,
          unpaidPOCount: 1,
          oldestDebt: 1,
          newestDebt: 1,
          purchaseOrders: 1
        }
      },
      { $sort: { totalOwed: -1 } }
    ]);

    // Compute totals
    const totalOwedAmount = creditors.reduce((s, c) => s + c.totalOwed, 0);
    const totalCreditors = creditors.length;
    const totalUnpaidPOs = creditors.reduce((s, c) => s + c.unpaidPOCount, 0);
    const totalPOValueAll = creditors.reduce((s, c) => s + c.totalPOValue, 0);
    const totalPaidAll = creditors.reduce((s, c) => s + c.totalPaid, 0);

    res.json({
      creditors,
      stats: {
        totalOwedAmount,
        totalCreditors,
        totalUnpaidPOs,
        totalPOValueAll,
        totalPaidAll,
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ──────────────────────────────────────────────────────────────
// GET /creditors/:supplierId/purchase-orders
// List all unpaid POs for a specific supplier
// ──────────────────────────────────────────────────────────────
const getCreditorPOs = async (req, res) => {
  try {
    const { branchId } = req.query;
    const query = {
      orgId: req.user.orgId,
      supplierId: req.params.supplierId,
      isDeleted: false,
      pendingAmount: { $gt: 0 }
    };

    if (branchId) query.branchId = branchId;

    const pos = await PurchaseOrder.find(query)
      .populate('supplierId', 'name contactEmail contactPhone address paymentTerms')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ purchaseOrders: pos });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ──────────────────────────────────────────────────────────────
// GET /creditors/all-purchase-orders
// List ALL unpaid POs (flat list, not grouped)
// ──────────────────────────────────────────────────────────────
const getAllUnpaidPOs = async (req, res) => {
  try {
    const { branchId, supplierId, startDate, endDate } = req.query;
    const query = {
      orgId: req.user.orgId,
      isDeleted: false,
      pendingAmount: { $gt: 0 }
    };

    if (branchId) query.branchId = branchId;
    if (supplierId) query.supplierId = supplierId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const pos = await PurchaseOrder.find(query)
      .populate('supplierId', 'name contactEmail contactPhone address paymentTerms')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ purchaseOrders: pos });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ──────────────────────────────────────────────────────────────
// GET /creditors/paid
// List ALL fully-paid POs (statement view)
// ──────────────────────────────────────────────────────────────
const getPaidPOs = async (req, res) => {
  try {
    const { branchId, supplierId, startDate, endDate } = req.query;
    const query = {
      orgId: req.user.orgId,
      isDeleted: false,
      pendingAmount: 0,
      paidAmount: { $gt: 0 }
    };

    if (branchId) query.branchId = branchId;
    if (supplierId) query.supplierId = supplierId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const pos = await PurchaseOrder.find(query)
      .populate('supplierId', 'name contactEmail contactPhone address paymentTerms')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ purchaseOrders: pos });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getCreditorsSummary, getCreditorPOs, getAllUnpaidPOs, getPaidPOs };
