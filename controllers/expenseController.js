const Joi = require('joi');
const Expense = require('../models/Expense');
const User = require('../models/User');
const mongoose = require('mongoose');

// Subcategories per category
const subCategories = {
  Operating: ['Rent', 'Utilities', 'Supplies', 'LicensesPermits'],
  Employee: ['SalariesWages', 'Meals', 'Welfare', 'Commissions'],
  Procurement: ['InventoryPurchase'], // Auto-derived
  SalesMarketing: ['Advertising', 'Promotions', 'Events'],
  FinancialAdministrative: ['BankCharges', 'ProfessionalFees', 'Subscriptions', 'Loans'],
  LogisticsTransportation: ['Shipping', 'Fuel', 'VehicleMaintenance'],
  CapitalFixed: ['Equipment', 'Furniture', 'Renovations'],
  Miscellaneous: ['Other']
};

// Validation Schemas
const createExpenseSchema = Joi.object({
  branchId: Joi.string().required(),
  category: Joi.string().valid(...Object.keys(subCategories)).required(),
  subCategory: Joi.string().custom((value, helpers) => {
    const category = helpers.state.ancestors[0].category;
    if (!subCategories[category].includes(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }).required(),
  amount: Joi.number().min(0).required(),
  description: Joi.string().allow('').optional(),
  dateIncurred: Joi.date().required(),
  status: Joi.string().valid('Pending', 'Paid', 'Overdue').optional(),
  paymentMethod: Joi.string().valid('Cash', 'BankTransfer', 'MobilePayment', 'Credit').optional()
});

const updateExpenseSchema = createExpenseSchema.options({ presence: 'optional' }).min(1);

// @desc    Create a new expense
// @route   POST /expenses
// @access  Owner/Manager/SuperManager
const createExpense = async (req, res) => {
  const { error } = createExpenseSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    // Fetch user to validate branch access
    const user = await User.findById(req.user.userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const hasBranchAccess = user.role === 'Owner' || (user.branchIds && user.branchIds.some(bId => bId.toString() === req.body.branchId));
    if (!hasBranchAccess) return res.status(403).json({ message: 'Branch not accessible' });

    const expense = new Expense({
      orgId: req.user.orgId,
      createdBy: req.user.userId,
      updatedBy: req.user.userId,
      ...req.body
    });
    await expense.save();
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update an expense
// @route   PUT /expenses/:id
// @access  Owner/Manager/SuperManager
const updateExpense = async (req, res) => {
  const { error } = updateExpenseSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const expense = await Expense.findOne({ _id: req.params.id, orgId: req.user.orgId, isDeleted: false });
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    // Validate branch access for the expense's branchId
    const user = await User.findById(req.user.userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const hasBranchAccess = user.role === 'Owner' || (user.branchIds && user.branchIds.some(bId => bId.toString() === expense.branchId.toString()));
    if (!hasBranchAccess) return res.status(403).json({ message: 'Branch not accessible' });

    if (req.body.subCategory && req.body.category) {
      if (!subCategories[req.body.category].includes(req.body.subCategory)) {
        return res.status(400).json({ message: 'Invalid subCategory for the category' });
      }
    } else if (req.body.subCategory && !req.body.category) {
      if (!subCategories[expense.category].includes(req.body.subCategory)) {
        return res.status(400).json({ message: 'Invalid subCategory for the existing category' });
      }
    } else if (!req.body.subCategory && req.body.category) {
      return res.status(400).json({ message: 'subCategory must be provided when updating category' });
    }

    const updatedExpense = await Expense.findOneAndUpdate(
      { _id: req.params.id, orgId: req.user.orgId },
      { ...req.body, updatedBy: req.user.userId },
      { new: true, runValidators: true }
    );
    res.json(updatedExpense);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Delete an expense (soft delete)
// @route   DELETE /expenses/:id
// @access  Owner/Manager/SuperManager
const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, orgId: req.user.orgId, isDeleted: false },
      { isDeleted: true, updatedBy: req.user.userId },
      { new: true }
    );
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    List expenses for organization
// @route   GET /expenses
// @access  Owner/Manager/Cashier/SuperManager
const listExpenses = async (req, res) => {
  try {
    const { branchId, category, subCategory, startDate, endDate, status } = req.query;
    const query = { orgId: req.user.orgId, isDeleted: false };

    const user = await User.findById(req.user.userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (branchId) {
      const hasBranchAccess = user.role === 'Owner' || (user.branchIds && user.branchIds.some(bId => bId.toString() === branchId));
      if (!hasBranchAccess) return res.status(403).json({ message: 'Branch not accessible' });
      query.branchId = branchId;
    } else if (user.role !== 'Owner') {
      // Non-owners see only their branches
      query.branchId = { $in: user.branchIds };
    }

    if (category) query.category = category;
    if (subCategory) query.subCategory = subCategory;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.dateIncurred = {};
      if (startDate) query.dateIncurred.$gte = new Date(startDate);
      if (endDate) query.dateIncurred.$lte = new Date(endDate);
    }

    const expenses = await Expense.find(query).lean();
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get expense summary
// @route   GET /expenses/summary
// @access  Owner/Manager/SuperManager
const getExpenseSummary = async (req, res) => {
  try {
    const { groupBy, startDate, endDate, branchId } = req.query;
    const user = await User.findById(req.user.userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const match = { orgId: req.user.orgId, isDeleted: false };

    if (branchId) {
      const hasBranchAccess = user.role === 'Owner' || (user.branchIds && user.branchIds.some(bId => bId.toString() === branchId));
      if (!hasBranchAccess) return res.status(403).json({ message: 'Branch not accessible' });
      match.branchId = new mongoose.Types.ObjectId(branchId);
    } else if (user.role !== 'Owner') {
      match.branchId = { $in: user.branchIds };
    }

    if (startDate || endDate) {
      match.dateIncurred = {};
      if (startDate) match.dateIncurred.$gte = new Date(startDate);
      if (endDate) match.dateIncurred.$lte = new Date(endDate);
    }

    let groupField;
    switch (groupBy) {
      case 'category':
        groupField = '$category';
        break;
      case 'subCategory':
        groupField = '$subCategory';
        break;
      case 'branchId':
        groupField = '$branchId';
        break;
      case 'month':
        groupField = { $dateToString: { format: '%Y-%m', date: '$dateIncurred' } };
        break;
      default:
        return res.status(400).json({ message: 'Invalid groupBy parameter' });
    }

    const summary = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: groupField,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createExpense, updateExpense, deleteExpense, listExpenses, getExpenseSummary };