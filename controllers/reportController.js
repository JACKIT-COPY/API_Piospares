const Joi = require('joi');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Expense = require('../models/Expense');
const PurchaseOrder = require('../models/PurchaseOrder');
const { Parser } = require('json2csv');

const timeFilterSchema = Joi.object({
  branchId: Joi.string().optional(),
  time: Joi.string().valid('today', 'week', 'month', 'year').required(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional().when('startDate', {
    is: Joi.exist(),
    then: Joi.required(),
  }),
});

// Helper to compute date ranges
const getDateRange = (time, startDate, endDate) => {
  const now = new Date();
  let range = {};
  if (startDate && endDate) {
    range = { $gte: new Date(startDate), $lte: new Date(endDate) };
  } else {
    switch (time) {
      case 'today':
        range = { $gte: new Date(now.setHours(0, 0, 0, 0)), $lte: new Date(now.setHours(23, 59, 59, 999)) };
        break;
      case 'week':
        range = { $gte: new Date(now.setDate(now.getDate() - 7)), $lte: new Date() };
        break;
      case 'month':
        range = { $gte: new Date(now.setMonth(now.getMonth() - 1)), $lte: new Date() };
        break;
      case 'year':
        range = { $gte: new Date(now.setFullYear(now.getFullYear() - 1)), $lte: new Date() };
        break;
    }
  }
  return range;
};

const getPrevDateRange = (range) => {
  const duration = (range.$lte - range.$gte) / (1000 * 60 * 60 * 24);
  return { $gte: new Date(range.$gte - duration * 24 * 60 * 60 * 1000), $lte: range.$gte };
};

// Helper to generate trend data
const getTrendData = (time, startDate, endDate) => {
  if (startDate && endDate) {
    const duration = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24);
    return duration <= 7 ? 'hour' : duration <= 30 ? 'day' : 'month';
  }
  switch (time) {
    case 'today': return 'hour';
    case 'week': return 'day';
    case 'month': return 'day';
    case 'year': return 'month';
  }
};

// @desc    Get sales summary
const getSalesSummary = async (req, res) => {
  try {
    const { error } = timeFilterSchema.validate(req.query);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { branchId, time, startDate, endDate } = req.query;
    const match = { orgId: req.user.orgId, status: { $ne: 'returned' } };
    if (branchId) match.branchId = branchId;
    match.createdAt = getDateRange(time, startDate, endDate);

    const groupBy = getTrendData(time, startDate, endDate);
    const dateFormat = groupBy === 'hour' ? {
      $dateToString: { format: '%Y-%m-%d %H:00', date: '$createdAt' }
    } : groupBy === 'day' ? {
      $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
    } : {
      $dateToString: { format: '%Y-%m', date: '$createdAt' }
    };

    const [salesStats, topProducts, categoryBreakdown, recentSales, salesByEmployee, salesTrend] = await Promise.all([
      Sale.aggregate([
        { $match: match },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),
      Sale.aggregate([
        { $match: match },
        { $unwind: '$products' },
        { $group: { _id: '$products.productId', name: { $first: '$products.name' }, quantity: { $sum: '$products.quantity' }, revenue: { $sum: '$products.price' } } },
        { $sort: { quantity: -1 } },
        { $limit: 5 },
      ]),
      Sale.aggregate([
        { $match: match },
        { $unwind: '$products' },
        { $lookup: { from: 'products', localField: 'products.productId', foreignField: '_id', as: 'product' } },
        { $unwind: '$product' },
        { $group: { _id: '$product.categoryId', name: { $first: '$product.categoryId' }, total: { $sum: '$products.price' } } },
        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
        { $unwind: '$category' },
        { $project: { name: '$category.name', total: 1 } },
      ]),
      Sale.find(match).sort({ createdAt: -1 }).limit(5).lean(),
      Sale.aggregate([
        { $match: match },
        { $group: { _id: '$employeeId', total: { $sum: '$total' }, count: { $sum: 1 } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'employee' } },
        { $unwind: '$employee' },
        { $project: { name: '$employee.name', total: 1, count: 1 } },
        { $sort: { total: -1 } },
        { $limit: 5 },
      ]),
      Sale.aggregate([
        { $match: match },
        { $group: { _id: dateFormat, value: { $sum: '$total' } } },
        { $sort: { _id: 1 } },
        { $project: { name: '$_id', value: 1, _id: 0 } },
      ]),
    ]);

    const prevMatch = { ...match, createdAt: getPrevDateRange(match.createdAt) };
    const prevSales = await Sale.aggregate([
      { $match: prevMatch },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]);

    const totalSales = salesStats[0]?.total || 0;
    const avgOrderValue = salesStats[0]?.count ? totalSales / salesStats[0].count : 0;
    const change = prevSales[0]?.total ? ((totalSales - prevSales[0].total) / prevSales[0].total * 100).toFixed(1) + '%' : 'N/A';

    res.json({
      stats: [
        { name: 'Total Sales', value: `KSh ${totalSales.toLocaleString()}`, change, changeType: change.includes('-') ? 'negative' : 'positive', icon: 'DollarSign', trend: change.includes('-') ? 'down' : 'up', description: `vs previous ${time}` },
        { name: 'Avg Order Value', value: `KSh ${avgOrderValue.toFixed(2)}`, change: 'N/A', changeType: 'neutral', icon: 'ShoppingCart', trend: 'neutral', description: 'per order' },
        { name: 'Returns', value: await Sale.countDocuments({ ...match, status: 'returned' }), change: 'N/A', changeType: 'negative', icon: 'AlertTriangle', trend: 'down', description: 'this period' },
        { name: 'Top Employee Sales', value: salesByEmployee[0]?.name || 'N/A', change: 'N/A', changeType: 'neutral', icon: 'Users', trend: 'neutral', description: `KSh ${salesByEmployee[0]?.total.toLocaleString() || 0}` },
      ],
      chartData: {
        salesTrend,
        categoryBreakdown: categoryBreakdown.map(item => ({ name: item.name, total: item.total })),
      },
      listItems: {
        topProducts: topProducts.map(item => ({ _id: item._id, name: item.name, quantity: item.quantity, revenue: item.revenue })),
        recentSales,
        salesByEmployee,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get inventory summary
const getInventorySummary = async (req, res) => {
  try {
    const { error } = timeFilterSchema.validate(req.query);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { branchId, time, startDate, endDate } = req.query;
    const match = { orgId: req.user.orgId, isDeleted: false };
    if (branchId) match.branchId = branchId;

    const [productsStats, lowStockItems, overStockItems, stockByCategory, turnover] = await Promise.all([
      Product.aggregate([
        { $match: match },
        { $group: { _id: null, count: { $sum: 1 }, totalValue: { $sum: { $multiply: ['$price', '$stock'] } } } },
      ]),
      Product.find({
        ...match,
        $expr: { $lte: ['$stock', { $ifNull: ['$minStock', 0] }] },
      }).limit(5).lean(),
      Product.find({
        ...match,
        $expr: { $gte: ['$stock', { $multiply: [{ $ifNull: ['$minStock', 0] }, 2] }] },
      }).limit(5).lean(),
      Product.aggregate([
        { $match: match },
        { $group: { _id: '$categoryId', totalStock: { $sum: '$stock' }, totalValue: { $sum: { $multiply: ['$price', '$stock'] } } } },
        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
        { $unwind: '$category' },
        { $project: { name: '$category.name', totalStock: 1, totalValue: 1 } },
      ]),
      Sale.aggregate([
        { $match: { ...match, createdAt: getDateRange(time, startDate, endDate) } },
        { $unwind: '$products' },
        { $group: { _id: '$products.productId', totalSold: { $sum: '$products.quantity' } } },
        { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
        { $unwind: '$product' },
        { $project: { name: '$product.name', totalSold: 1, stock: '$product.stock' } },
        { $match: { stock: { $gt: 0 } } },
        { $project: { name: 1, turnoverRate: { $divide: ['$totalSold', '$stock'] } } },
        { $sort: { turnoverRate: -1 } },
        { $limit: 5 },
      ]),
    ]);

    res.json({
      stats: [
        { name: 'Total Products', value: productsStats[0]?.count || 0, change: 'N/A', changeType: 'neutral', icon: 'Package', trend: 'neutral', description: 'active items' },
        { name: 'Low Stock Items', value: lowStockItems.length, change: 'N/A', changeType: 'negative', icon: 'AlertTriangle', trend: 'down', description: 'need restock' },
        { name: 'Overstock Items', value: overStockItems.length, change: 'N/A', changeType: 'negative', icon: 'AlertTriangle', trend: 'down', description: 'excess stock' },
        { name: 'Stock Value', value: `KSh ${productsStats[0]?.totalValue.toLocaleString() || 0}`, change: 'N/A', changeType: 'neutral', icon: 'DollarSign', trend: 'neutral', description: 'current value' },
      ],
      chartData: {
        stockByCategory: stockByCategory.map(item => ({ name: item.name, total: item.totalValue })),
        turnover: turnover.map(item => ({ name: item.name, value: item.turnoverRate })),
      },
      listItems: {
        lowStockItems,
        overStockItems,
        topTurnover: turnover,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get expenses summary
const getExpensesSummary = async (req, res) => {
  try {
    const { error } = timeFilterSchema.validate(req.query);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { branchId, time, startDate, endDate } = req.query;
    const match = { orgId: req.user.orgId, isDeleted: false };
    if (branchId) match.branchId = branchId;
    match.dateIncurred = getDateRange(time, startDate, endDate);

    const groupBy = getTrendData(time, startDate, endDate);
    const dateFormat = groupBy === 'hour' ? {
      $dateToString: { format: '%Y-%m-%d %H:00', date: '$dateIncurred' }
    } : groupBy === 'day' ? {
      $dateToString: { format: '%Y-%m-%d', date: '$dateIncurred' }
    } : {
      $dateToString: { format: '%Y-%m', date: '$dateIncurred' }
    };

    const [expenseStats, overdueExpenses, statusBreakdown, categoryBreakdown, topVendors, expenseTrend] = await Promise.all([
      Expense.aggregate([
        { $match: match },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Expense.find({ ...match, status: 'Overdue' }).limit(5).lean(),
      Expense.aggregate([
        { $match: match },
        { $group: { _id: '$status', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Expense.aggregate([
        { $match: match },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
      ]),
      Expense.aggregate([
        { $match: match },
        { $group: { _id: '$vendor', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 5 },
      ]),
      Expense.aggregate([
        { $match: match },
        { $group: { _id: dateFormat, value: { $sum: '$amount' } } },
        { $sort: { _id: 1 } },
        { $project: { name: '$_id', value: 1, _id: 0 } },
      ]),
    ]);

    const prevMatch = { ...match, dateIncurred: getPrevDateRange(match.dateIncurred) };
    const prevExpenses = await Expense.aggregate([
      { $match: prevMatch },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const totalExpenses = expenseStats[0]?.total || 0;
    const change = prevExpenses[0]?.total ? ((totalExpenses - prevExpenses[0].total) / prevExpenses[0].total * 100).toFixed(1) + '%' : 'N/A';

    res.json({
      stats: [
        { name: 'Total Expenses', value: `KSh ${totalExpenses.toLocaleString()}`, change, changeType: change.includes('-') ? 'positive' : 'negative', icon: 'DollarSign', trend: change.includes('-') ? 'down' : 'up', description: `vs previous ${time}` },
        { name: 'Overdue Expenses', value: overdueExpenses.length, change: 'N/A', changeType: 'negative', icon: 'AlertTriangle', trend: 'down', description: 'pending payment' },
        { name: 'Top Category', value: categoryBreakdown[0]?._id || 'N/A', change: 'N/A', changeType: 'neutral', icon: 'BarChart3', trend: 'neutral', description: `KSh ${categoryBreakdown[0]?.total.toLocaleString() || 0}` },
        { name: 'Top Vendor', value: topVendors[0]?._id || 'N/A', change: 'N/A', changeType: 'neutral', icon: 'Users', trend: 'neutral', description: `KSh ${topVendors[0]?.total.toLocaleString() || 0}` },
      ],
      chartData: {
        expenseTrend,
        categoryBreakdown: categoryBreakdown.map(item => ({ name: item._id, total: item.total })),
        statusBreakdown: statusBreakdown.map(item => ({ name: item._id, total: item.total })),
      },
      listItems: {
        overdueExpenses,
        topVendors,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get procurement summary
const getProcurementSummary = async (req, res) => {
  try {
    const { error } = timeFilterSchema.validate(req.query);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { branchId, time, startDate, endDate } = req.query;
    const match = { orgId: req.user.orgId, isDeleted: false };
    if (branchId) match.branchId = branchId;
    match.createdAt = getDateRange(time, startDate, endDate);

    const groupBy = getTrendData(time, startDate, endDate);
    const dateFormat = groupBy === 'hour' ? {
      $dateToString: { format: '%Y-%m-%d %H:00', date: '$createdAt' }
    } : groupBy === 'day' ? {
      $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
    } : {
      $dateToString: { format: '%Y-%m', date: '$createdAt' }
    };

    const [poStats, pendingPOs, statusBreakdown, supplierBreakdown, spendTrend] = await Promise.all([
      PurchaseOrder.aggregate([
        { $match: match },
        { $group: { _id: null, total: { $sum: '$totalCost' }, count: { $sum: 1 } } },
      ]),
      PurchaseOrder.find({ ...match, status: 'pending' }).limit(5).lean(),
      PurchaseOrder.aggregate([
        { $match: match },
        { $group: { _id: '$status', total: { $sum: '$totalCost' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      PurchaseOrder.aggregate([
        { $match: match },
        { $group: { _id: '$supplierId', total: { $sum: '$totalCost' } } },
        { $lookup: { from: 'suppliers', localField: '_id', foreignField: '_id', as: 'supplier' } },
        { $unwind: '$supplier' },
        { $project: { name: '$supplier.name', total: 1 } },
        { $sort: { total: -1 } },
        { $limit: 5 },
      ]),
      PurchaseOrder.aggregate([
        { $match: match },
        { $group: { _id: dateFormat, value: { $sum: '$totalCost' } } },
        { $sort: { _id: 1 } },
        { $project: { name: '$_id', value: 1, _id: 0 } },
      ]),
    ]);

    const prevMatch = { ...match, createdAt: getPrevDateRange(match.createdAt) };
    const prevPOs = await PurchaseOrder.aggregate([
      { $match: prevMatch },
      { $group: { _id: null, total: { $sum: '$totalCost' } } },
    ]);

    const totalSpend = poStats[0]?.total || 0;
    const change = prevPOs[0]?.total ? ((totalSpend - prevPOs[0].total) / prevPOs[0].total * 100).toFixed(1) + '%' : 'N/A';

    res.json({
      stats: [
        { name: 'Total POs', value: poStats[0]?.count || 0, change: 'N/A', changeType: 'neutral', icon: 'Truck', trend: 'neutral', description: 'created' },
        { name: 'Pending POs', value: pendingPOs.length, change: 'N/A', changeType: 'negative', icon: 'AlertTriangle', trend: 'down', description: 'awaiting receipt' },
        { name: 'Total Spend', value: `KSh ${totalSpend.toLocaleString()}`, change, changeType: change.includes('-') ? 'positive' : 'negative', icon: 'DollarSign', trend: change.includes('-') ? 'down' : 'up', description: `vs previous ${time}` },
        { name: 'Top Supplier', value: supplierBreakdown[0]?.name || 'N/A', change: 'N/A', changeType: 'neutral', icon: 'Users', trend: 'neutral', description: `KSh ${supplierBreakdown[0]?.total.toLocaleString() || 0}` },
      ],
      chartData: {
        spendTrend,
        supplierBreakdown: supplierBreakdown.map(item => ({ name: item.name, total: item.total })),
        statusBreakdown: statusBreakdown.map(item => ({ name: item._id, total: item.total })),
      },
      listItems: {
        pendingPOs,
        topSuppliers: supplierBreakdown,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Export report data as CSV
const exportReport = async (req, res) => {
  try {
    const { type } = req.params;
    const { branchId, time, startDate, endDate } = req.query;
    const match = { orgId: req.user.orgId, isDeleted: false };
    if (branchId) match.branchId = branchId;

    let data = [];
    let fields = [];
    let filename = '';

    switch (type) {
      case 'sales':
        match.createdAt = getDateRange(time, startDate, endDate);
        data = await Sale.find(match).lean();
        fields = ['_id', 'total', 'status', 'createdAt', 'employeeId', 'branchId'];
        filename = 'sales_report.csv';
        break;
      case 'inventory':
        data = await Product.find(match).lean();
        fields = ['_id', 'name', 'stock', 'minStock', 'price', 'categoryId', 'branchId'];
        filename = 'inventory_report.csv';
        break;
      case 'expenses':
        match.dateIncurred = getDateRange(time, startDate, endDate);
        data = await Expense.find(match).lean();
        fields = ['_id', 'amount', 'category', 'subCategory', 'status', 'vendor', 'dateIncurred', 'branchId'];
        filename = 'expenses_report.csv';
        break;
      case 'procurement':
        match.createdAt = getDateRange(time, startDate, endDate);
        data = await PurchaseOrder.find(match).lean();
        fields = ['_id', 'totalCost', 'status', 'supplierId', 'createdAt', 'branchId'];
        filename = 'procurement_report.csv';
        break;
      default:
        return res.status(400).json({ message: 'Invalid report type' });
    }

    const parser = new Parser({ fields });
    const csv = parser.parse(data);
    res.header('Content-Type', 'text/csv');
    res.attachment(filename);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getSalesSummary, getInventorySummary, getExpensesSummary, getProcurementSummary, exportReport };