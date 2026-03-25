const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Customer = require('../models/Customer');

// ──────────────────────────────────────────────────────────────
// GET /debtors/summary
// Aggregate all pending sales grouped by customer
// ──────────────────────────────────────────────────────────────
const getDebtorsSummary = async (req, res) => {
  try {
    const { branchId, startDate, endDate } = req.query;
    const orgId = new mongoose.Types.ObjectId(req.user.orgId);

    const match = {
      orgId,
      isDeleted: false,
      customerId: { $ne: null },
      $or: [
        { paymentMethod: 'pending' },
        { status: 'pending' },
        {
          paymentMethod: 'split',
          'paymentSplits.method': 'pending',
          'paymentSplits.completed': false
        }
      ]
    };

    if (branchId) match.branchId = new mongoose.Types.ObjectId(branchId);
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    const debtors = await Sale.aggregate([
      { $match: match },
      {
        $addFields: {
          pendingAmount: {
            $cond: {
              if: { $eq: ['$paymentMethod', 'split'] },
              then: {
                $sum: {
                  $map: {
                    input: {
                      $filter: {
                        input: '$paymentSplits',
                        as: 'sp',
                        cond: {
                          $and: [
                            { $eq: ['$$sp.method', 'pending'] },
                            { $ne: ['$$sp.completed', true] }
                          ]
                        }
                      }
                    },
                    as: 'sp',
                    in: '$$sp.amount'
                  }
                }
              },
              else: '$total'
            }
          }
        }
      },
      {
        $group: {
          _id: '$customerId',
          totalDebt: { $sum: '$pendingAmount' },
          totalSalesValue: { $sum: '$total' },
          pendingSalesCount: { $sum: 1 },
          oldestDebt: { $min: '$createdAt' },
          newestDebt: { $max: '$createdAt' },
          sales: {
            $push: {
              _id: '$_id',
              total: '$total',
              pendingAmount: '$pendingAmount',
              paymentMethod: '$paymentMethod',
              paymentSplits: '$paymentSplits',
              status: '$status',
              products: '$products',
              discount: '$discount',
              branchId: '$branchId',
              createdAt: '$createdAt'
            }
          }
        }
      },
      {
        $lookup: {
          from: 'customers',
          localField: '_id',
          foreignField: '_id',
          as: 'customer'
        }
      },
      { $unwind: '$customer' },
      {
        $project: {
          _id: 0,
          customerId: '$_id',
          customerName: '$customer.name',
          customerPhone: '$customer.phone',
          customerEmail: '$customer.email',
          customerAddress: '$customer.address',
          totalDebt: 1,
          totalSalesValue: 1,
          pendingSalesCount: 1,
          oldestDebt: 1,
          newestDebt: 1,
          sales: 1
        }
      },
      { $sort: { totalDebt: -1 } }
    ]);

    // Compute totals
    const totalDebtAmount = debtors.reduce((s, d) => s + d.totalDebt, 0);
    const totalDebtors = debtors.length;
    const totalPendingSales = debtors.reduce((s, d) => s + d.pendingSalesCount, 0);

    res.json({
      debtors,
      stats: {
        totalDebtAmount,
        totalDebtors,
        totalPendingSales,
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ──────────────────────────────────────────────────────────────
// GET /debtors/:customerId/sales
// List all pending sales for a specific customer
// ──────────────────────────────────────────────────────────────
const getDebtorSales = async (req, res) => {
  try {
    const { branchId } = req.query;
    const orgId = req.user.orgId;

    const query = {
      orgId,
      customerId: req.params.customerId,
      isDeleted: false,
      $or: [
        { paymentMethod: 'pending' },
        { status: 'pending' },
        {
          paymentMethod: 'split',
          'paymentSplits.method': 'pending',
          'paymentSplits.completed': false
        }
      ]
    };

    if (branchId) query.branchId = branchId;

    const sales = await Sale.find(query)
      .populate('customerId', 'name phone email address')
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    // Compute pending amount per sale
    const enriched = sales.map(s => {
      let pendingAmount = s.total;
      if (s.paymentMethod === 'split') {
        pendingAmount = (s.paymentSplits || [])
          .filter(sp => sp.method === 'pending' && !sp.completed)
          .reduce((sum, sp) => sum + sp.amount, 0);
      }
      return { ...s, pendingAmount };
    });

    res.json({ sales: enriched });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ──────────────────────────────────────────────────────────────
// GET /debtors/all-sales
// List ALL pending sales (flat list, not grouped)
// ──────────────────────────────────────────────────────────────
const getAllPendingSales = async (req, res) => {
  try {
    const { branchId, customerId, startDate, endDate } = req.query;
    const query = {
      orgId: req.user.orgId,
      isDeleted: false,
      $or: [
        { paymentMethod: 'pending' },
        { status: 'pending' },
        {
          paymentMethod: 'split',
          'paymentSplits.method': 'pending',
          'paymentSplits.completed': false
        }
      ]
    };

    if (branchId) query.branchId = branchId;
    if (customerId) query.customerId = customerId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const sales = await Sale.find(query)
      .populate('customerId', 'name phone email address')
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const enriched = sales.map(s => {
      let pendingAmount = s.total;
      if (s.paymentMethod === 'split') {
        pendingAmount = (s.paymentSplits || [])
          .filter(sp => sp.method === 'pending' && !sp.completed)
          .reduce((sum, sp) => sum + sp.amount, 0);
      }
      return { ...s, pendingAmount };
    });

    res.json({ sales: enriched });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getDebtorsSummary, getDebtorSales, getAllPendingSales };
