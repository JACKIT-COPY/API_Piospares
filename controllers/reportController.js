// controllers/reportController.js
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const PurchaseOrder = require('../models/PurchaseOrder');
const Expense = require('../models/Expense');
const Report = require('../models/Report');
const Branch = require('../models/Branch');
const getDateRange = require('../utils/dateRange');

// Helper: Cache or compute
const getCachedOrCompute = async (orgId, branchId, periodType, start, end, module, computeFn) => {
  const cacheKey = { orgId, branchId: branchId || null, periodType, startDate: start, module };
  const cached = await Report.findOne(cacheKey);
  if (cached && cached.expiresAt > new Date()) return cached.data;

  const data = await computeFn();
  await Report.findOneAndUpdate(
    cacheKey,
    { endDate: end, data, generatedAt: new Date(), expiresAt: new Date(Date.now() + 60 * 1000) },
    { upsert: true, new: true }
  );
  return data;
};

// ──────────────────────────────────────────────────────────────
// INVENTORY REPORT
// ──────────────────────────────────────────────────────────────
const inventoryReport = async (orgId, branchId, start, end) => {
  const match = { orgId: new mongoose.Types.ObjectId(orgId), isDeleted: false };
  if (branchId) match.branchId = new mongoose.Types.ObjectId(branchId);

  // POPULATE categoryId to get the name
  const products = await Product.find(match)
    .populate('categoryId', 'name')  // This is the key line
    .lean();

  const totalValue = products.reduce((sum, p) => sum + (p.stock * p.price), 0);
  const totalCost = products.reduce((sum, p) => sum + (p.stock * (p.averageCost || p.buyingPrice || 0)), 0);
  const totalProfit = totalValue - totalCost;

  const lowStock = products.filter(p => p.stock <= p.minStock);
  const outOfStock = products.filter(p => p.stock === 0);

  const byCategory = {};
  const byBranch = {};
  const topByValue = [];
  const topByQty = [];

  products.forEach(p => {
    // Use actual category name if populated
    const catId = p.categoryId?._id?.toString() || 'uncategorized';
    const catName = p.categoryId?.name || 'Uncategorized';

    const branch = p.branchId?.toString();

    // Category
    if (!byCategory[catId]) {
      byCategory[catId] = { 
        value: 0, cost: 0, qty: 0, profit: 0, products: 0,
        categoryName: catName  // Store the real name
      };
    }
    byCategory[catId].value += p.stock * p.price;
    byCategory[catId].cost += p.stock * (p.averageCost || p.buyingPrice || 0);
    byCategory[catId].qty += p.stock;
    byCategory[catId].products += 1;

    // Branch
    if (!byBranch[branch]) byBranch[branch] = { value: 0, qty: 0 };
    byBranch[branch].value += p.stock * p.price;
    byBranch[branch].qty += p.stock;

    // Top products
    topByValue.push({ _id: p._id, name: p.name, value: p.stock * p.price });
    topByQty.push({ _id: p._id, name: p.name, qty: p.stock });
  });

  // Calculate profit & margin
  Object.keys(byCategory).forEach(catId => {
    const cat = byCategory[catId];
    cat.profit = cat.value - cat.cost;
    cat.margin = cat.value ? (cat.profit / cat.value) * 100 : 0;
  });

  return {
    totalInventoryValue: totalValue,
    totalCostValue: totalCost,
    totalProfit,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    lowStock: lowStock.map(p => ({ _id: p._id, name: p.name, stock: p.stock, minStock: p.minStock })),
    outOfStock: outOfStock.map(p => ({ _id: p._id, name: p.name })),
    
    // Include categoryName in byCategory
    byCategory: Object.entries(byCategory).map(([id, data]) => ({ 
      categoryId: id, 
      categoryName: data.categoryName,  // This is what frontend uses
      ...data 
    })),

    byBranch: Object.entries(byBranch).map(([id, data]) => ({ branchId: id, ...data })),

    topProductsByValue: topByValue.sort((a, b) => b.value - a.value).slice(0, 10),
    topProductsByQuantity: topByQty.sort((a, b) => b.qty - a.qty).slice(0, 10),

    // Also fix topCategoriesByValue to include name
    topCategoriesByValue: Object.entries(byCategory)
      .map(([id, data]) => ({ 
        categoryId: id, 
        categoryName: data.categoryName, 
        value: data.value 
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  };
};


// ──────────────────────────────────────────────────────────────
// SALES REPORT
// ──────────────────────────────────────────────────────────────
const salesReport = async (orgId, branchId, start, end) => {
  const saleQuery = {
    orgId: new mongoose.Types.ObjectId(orgId),
    createdAt: { $gte: start, $lte: end },
    isDeleted: false
  };
  if (branchId) saleQuery.branchId = new mongoose.Types.ObjectId(branchId);
  const sales = await Sale.find(saleQuery).lean();

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalDiscount = sales.reduce((sum, s) => sum + (s.discount || 0), 0);
  const grossRevenue = totalRevenue + totalDiscount;
  const totalTransactions = sales.filter(s => s.status === 'completed').length;
  const pendingSales = sales.filter(s => s.status === 'pending').length;

  const itemsSold = sales.reduce((sum, s) => sum + s.products.reduce((acc, p) => acc + p.quantity, 0), 0);

  const byProduct = {};
  const byCategory = {};
  const byPayment = {};
  const byHour = Array(24).fill(0).map(() => ({ count: 0, revenue: 0 }));

  sales.forEach(s => {
    if (s.status !== 'completed') return;

    // Payment
    byPayment[s.paymentMethod] = (byPayment[s.paymentMethod] || 0) + s.total;

    // Hour
    const hour = new Date(s.createdAt).getHours();
    byHour[hour].count++;
    byHour[hour].revenue += s.total;

    s.products.forEach(p => {
      byProduct[p.productId] = (byProduct[p.productId] || { qty: 0, revenue: 0, name: p.name });
      byProduct[p.productId].qty += p.quantity;
      byProduct[p.productId].revenue += p.price * p.quantity;
    });
  });

  // Inside salesReport()
const dailySales = {}
sales.forEach(s => {
  if (s.status !== 'completed') return
  const dateKey = s.createdAt.toISOString().split('T')[0]
  if (!dailySales[dateKey]) {
    dailySales[dateKey] = { revenue: 0, transactions: 0 }
  }
  dailySales[dateKey].revenue += s.total
  dailySales[dateKey].transactions += 1
})

  return {
    totalRevenue,
    grossRevenue,
    totalDiscount,
    totalTransactions,
    pendingSalesCount: pendingSales,
    itemsSold,
    avgTicket: totalTransactions ? totalRevenue / totalTransactions : 0,
    salesByPaymentMethod: Object.entries(byPayment).map(([method, revenue]) => ({ method, revenue })),
    topProducts: Object.values(byProduct)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10),
    peakHours: byHour
      .map((h, i) => ({ hour: i, count: h.count, revenue: h.revenue }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
      dailyBreakdown: Object.entries(dailySales).map(([date, data]) => ({
    date,
    revenue: data.revenue,
    transactions: data.transactions,
  }))
  };

};

// ──────────────────────────────────────────────────────────────
// PROCUREMENT REPORT
// ──────────────────────────────────────────────────────────────
const procurementReport = async (orgId, branchId, start, end) => {
  const poQuery = {
    orgId: new mongoose.Types.ObjectId(orgId),
    createdAt: { $gte: start, $lte: end },
    isDeleted: false
  };
  if (branchId) poQuery.branchId = new mongoose.Types.ObjectId(branchId);
  const pos = await PurchaseOrder.find(poQuery).populate('supplierId', 'name').lean();

  const totalPOs = pos.length;
  const pendingPOs = pos.filter(p => ['pending', 'ordered'].includes(p.status)).length;
  const receivedPOs = pos.filter(p => p.status === 'received').length;
  const totalSpend = pos.filter(p => p.status === 'received').reduce((sum, p) => sum + (p.totalCost || 0), 0);

  const itemsOrdered = pos.reduce((sum, p) => sum + p.items.reduce((acc, i) => acc + i.quantity, 0), 0);
  const itemsReceived = pos.reduce((sum, p) => sum + p.items.reduce((acc, i) => acc + (i.receivedQuantity || 0), 0), 0);

  const bySupplier = {};
  const byBranch = {};
  const byItem = {};

  pos.forEach(p => {
    if (p.status !== 'received') return;

    const sup = p.supplierId?._id?.toString() || 'Unknown';
    bySupplier[sup] = (bySupplier[sup] || 0) + (p.totalCost || 0);

    const branch = p.branchId?.toString();
    byBranch[branch] = (byBranch[branch] || 0) + (p.totalCost || 0);

    p.items.forEach(i => {
      byItem[i.productId] = (byItem[i.productId] || 0) + i.quantity;
    });
  });

  return {
    totalPOs,
    pendingPOsCount: pendingPOs,
    receivedPOsCount: receivedPOs,
    totalSpend,
    itemsOrdered,
    itemsReceived,
    fulfillmentRate: itemsOrdered ? (itemsReceived / itemsOrdered) * 100 : 0,
    spendingByBranch: Object.entries(byBranch).map(([id, spend]) => ({ branchId: id, spend })),
    topItemsOrdered: Object.entries(byItem)
      .map(([id, qty]) => ({ productId: id, quantity: qty }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10),
    topSuppliersBySpend: Object.entries(bySupplier)
      .map(([id, spend]) => ({ supplierId: id, spend }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5),
    overduePOs: pos.filter(p => p.expectedDeliveryDate && new Date(p.expectedDeliveryDate) < new Date() && p.status !== 'received').length
  };
};

// ──────────────────────────────────────────────────────────────
// EXPENSES REPORT
// ──────────────────────────────────────────────────────────────
const expensesReport = async (orgId, branchId, start, end) => {
  const expenseQuery = {
    orgId: new mongoose.Types.ObjectId(orgId),
    dateIncurred: { $gte: start, $lte: end },
    isDeleted: false
  };
  if (branchId) expenseQuery.branchId = new mongoose.Types.ObjectId(branchId);
  const expenses = await Expense.find(expenseQuery).lean();

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const pending = expenses.filter(e => e.status === 'Pending').reduce((sum, e) => sum + e.amount, 0);
  const overdue = expenses.filter(e => e.status === 'Overdue').reduce((sum, e) => sum + e.amount, 0);

  const byCategory = {};
  const byBranch = {};
  const byPayment = {};

  expenses.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    byBranch[e.branchId] = (byBranch[e.branchId] || 0) + e.amount;
    if (e.paymentMethod) byPayment[e.paymentMethod] = (byPayment[e.paymentMethod] || 0) + e.amount;
  });

  return {
    totalExpenses: total,
    pendingAmount: pending,
    overdueAmount: overdue,
    paidAmount: total - pending - overdue,
    byCategory: Object.entries(byCategory).map(([cat, amt]) => ({ category: cat, amount: amt })),
    byBranch: Object.entries(byBranch).map(([id, amt]) => ({ branchId: id, amount: amt })),
    byPaymentMethod: Object.entries(byPayment).map(([method, amt]) => ({ method, amount: amt })),
    topCategories: Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, amt]) => ({ category: cat, amount: amt }))
  };
};

// ──────────────────────────────────────────────────────────────
// MAIN: Get Report
// ──────────────────────────────────────────────────────────────
const getReport = async (req, res) => {
  const { period = 'weekly', date, module = 'all', branchId } = req.query;
  const validPeriods = ['daily', 'weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly'];
  const validModules = ['inventory', 'sales', 'procurement', 'expenses', 'all'];

  if (!validPeriods.includes(period)) return res.status(400).json({ message: 'Invalid period' });
  if (!validModules.includes(module)) return res.status(400).json({ message: 'Invalid module' });

  try {
    const { start, end } = getDateRange(period, date);
    const orgId = req.user.orgId;

    // Validate branchId belongs to current org (if provided)
    let validatedBranchId = null;
    if (branchId) {
      if (!mongoose.isValidObjectId(branchId)) {
        return res.status(400).json({ message: 'Invalid branchId' });
      }
      const branch = await Branch.findOne({ _id: branchId, orgId: new mongoose.Types.ObjectId(orgId) }).lean();
      if (!branch) return res.status(400).json({ message: 'Branch not found or does not belong to your organization' });
      validatedBranchId = branchId;
    }

    const result = {};

    if (module === 'all' || module === 'inventory') {
      result.inventory = await getCachedOrCompute(orgId, validatedBranchId, period, start, end, 'inventory', () => inventoryReport(orgId, validatedBranchId, start, end));
    }
    if (module === 'all' || module === 'sales') {
      result.sales = await getCachedOrCompute(orgId, validatedBranchId, period, start, end, 'sales', () => salesReport(orgId, validatedBranchId, start, end));
    }
    if (module === 'all' || module === 'procurement') {
      result.procurement = await getCachedOrCompute(orgId, validatedBranchId, period, start, end, 'procurement', () => procurementReport(orgId, validatedBranchId, start, end));
    }
    if (module === 'all' || module === 'expenses') {
      result.expenses = await getCachedOrCompute(orgId, validatedBranchId, period, start, end, 'expenses', () => expensesReport(orgId, validatedBranchId, start, end));
    }

    // Add profitability if all
    if (module === 'all') {
      const profit = (result.sales?.totalRevenue || 0) - (result.expenses?.totalExpenses || 0);
      result.profitability = { netProfit: profit };
    }

    res.json({
      period: { type: period, start, end },
      ...result
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getReport };