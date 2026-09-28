const Sale = require('../models/Sale');
const PurchaseOrder = require('../models/PurchaseOrder');

// @desc    Get debtors summary
const getDebtorsSummary = async (req, res) => {
  try {
    const { branchId } = req.query;
    const match = { orgId: req.user.orgId, paymentMethod: 'pending' };
    if (branchId) match.branchId = branchId;

    const pendingSales = await Sale.find(match).populate('userId', 'name').lean();

    // Map into debtors
    const debtorsMap = {};
    let totalDebtAmount = 0;
    let totalPendingSales = 0;

    pendingSales.forEach(sale => {
      // Mocking customer details since customerId is not fully implemented in Sale model yet
      const custId = 'CUST-1'; 
      if (!debtorsMap[custId]) {
        debtorsMap[custId] = {
          customerId: custId,
          customerName: 'Walk-in Customer (Pending)',
          customerPhone: 'N/A',
          customerEmail: 'N/A',
          customerAddress: 'N/A',
          totalDebt: 0,
          totalSalesValue: 0,
          pendingSalesCount: 0,
          oldestDebt: sale.createdAt,
          newestDebt: sale.createdAt,
          sales: []
        };
      }
      
      const debt = sale.total;
      debtorsMap[custId].totalDebt += debt;
      debtorsMap[custId].totalSalesValue += debt;
      debtorsMap[custId].pendingSalesCount += 1;
      debtorsMap[custId].sales.push({
        _id: sale._id,
        total: sale.total,
        pendingAmount: debt,
        paymentMethod: sale.paymentMethod,
        status: sale.status,
        products: sale.products,
        discount: sale.discount,
        branchId: sale.branchId,
        createdAt: sale.createdAt
      });

      totalDebtAmount += debt;
      totalPendingSales += 1;
      
      if (new Date(sale.createdAt) < new Date(debtorsMap[custId].oldestDebt)) {
        debtorsMap[custId].oldestDebt = sale.createdAt;
      }
    });

    res.json({
      debtors: Object.values(debtorsMap),
      stats: {
        totalDebtAmount,
        totalDebtors: Object.keys(debtorsMap).length,
        totalPendingSales
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get creditors summary
const getCreditorsSummary = async (req, res) => {
  try {
    const { branchId } = req.query;
    const match = { orgId: req.user.orgId, status: { $in: ['pending', 'ordered'] } };
    if (branchId) match.branchId = branchId;

    const pendingPOs = await PurchaseOrder.find(match).populate('supplierId').lean();

    const creditorsMap = {};
    let totalOwedAmount = 0;
    let totalUnpaidPOs = 0;
    let totalPOValueAll = 0;
    let totalPaidAll = 0;

    pendingPOs.forEach(po => {
      const supp = po.supplierId || {};
      const suppId = supp._id || 'unknown';
      if (!creditorsMap[suppId]) {
        creditorsMap[suppId] = {
          supplierId: suppId,
          supplierName: supp.name || 'Unknown Supplier',
          supplierPhone: supp.contactPhone || 'N/A',
          supplierEmail: supp.contactEmail || 'N/A',
          supplierAddress: supp.address || 'N/A',
          paymentTerms: supp.paymentTerms || 'N/A',
          totalOwed: 0,
          totalPOValue: 0,
          totalPaid: 0,
          unpaidPOCount: 0,
          oldestDebt: po.createdAt,
          newestDebt: po.createdAt,
          purchaseOrders: []
        };
      }

      // Since paidAmount is not tracked yet, assume 0 for pending POs
      const paid = 0;
      const owed = po.totalCost - paid;

      creditorsMap[suppId].totalOwed += owed;
      creditorsMap[suppId].totalPOValue += po.totalCost;
      creditorsMap[suppId].totalPaid += paid;
      creditorsMap[suppId].unpaidPOCount += 1;
      creditorsMap[suppId].purchaseOrders.push({
        _id: po._id,
        totalCost: po.totalCost,
        paidAmount: paid,
        pendingAmount: owed,
        status: po.status,
        items: po.items,
        notes: po.notes,
        branchId: po.branchId,
        createdAt: po.createdAt
      });

      totalOwedAmount += owed;
      totalPOValueAll += po.totalCost;
      totalPaidAll += paid;
      totalUnpaidPOs += 1;

      if (new Date(po.createdAt) < new Date(creditorsMap[suppId].oldestDebt)) {
        creditorsMap[suppId].oldestDebt = po.createdAt;
      }
    });

    res.json({
      creditors: Object.values(creditorsMap),
      stats: {
        totalOwedAmount,
        totalCreditors: Object.keys(creditorsMap).length,
        totalUnpaidPOs,
        totalPOValueAll,
        totalPaidAll
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getDebtorsSummary, getCreditorsSummary };
