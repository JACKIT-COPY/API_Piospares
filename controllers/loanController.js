const Joi = require('joi');
const loanService = require('../services/loanService');
const User = require('../models/User');

// Schema for "Given" loans (org lends to someone)
const givenLoanSchema = Joi.object({
  direction: Joi.string().valid('Given').required(),
  branchId: Joi.string().required(),
  borrowerId: Joi.string().required(),
  borrowerModel: Joi.string().valid('Customer', 'User', 'Supplier').optional(),
  principal: Joi.number().min(0).required(),
  interestRate: Joi.number().min(0).required(),
  termMonths: Joi.number().min(1).required(),
  startDate: Joi.date().optional(),
  installments: Joi.array().items(Joi.object({ dueDate: Joi.date().required(), amount: Joi.number().min(0).required() })).optional()
});

// Schema for "Received" loans (org borrows from someone)
const receivedLoanSchema = Joi.object({
  direction: Joi.string().valid('Received').required(),
  branchId: Joi.string().required(),
  lenderName: Joi.string().required(),
  lenderType: Joi.string().valid('Supplier', 'Customer', 'User', 'Other').optional(),
  lenderId: Joi.string().allow('', null).optional(),
  principal: Joi.number().min(0).required(),
  interestRate: Joi.number().min(0).required(),
  termMonths: Joi.number().min(1).required(),
  startDate: Joi.date().optional(),
  installments: Joi.array().items(Joi.object({ dueDate: Joi.date().required(), amount: Joi.number().min(0).required() })).optional()
});

const updateLoanSchema = Joi.object({
  branchId: Joi.string(),
  borrowerId: Joi.string(),
  borrowerModel: Joi.string().valid('Customer', 'User', 'Supplier'),
  lenderName: Joi.string(),
  lenderType: Joi.string().valid('Supplier', 'Customer', 'User', 'Other'),
  lenderId: Joi.string().allow('', null),
  principal: Joi.number().min(0),
  interestRate: Joi.number().min(0),
  termMonths: Joi.number().min(1),
  startDate: Joi.date(),
  status: Joi.string().valid('Pending', 'Active', 'Paid', 'Defaulted'),
  installments: Joi.array().items(Joi.object({ dueDate: Joi.date().required(), amount: Joi.number().min(0).required() }))
}).min(1);

const createLoan = async (req, res) => {
  // Pick schema based on direction
  const direction = req.body.direction || 'Given';
  const schema = direction === 'Received' ? receivedLoanSchema : givenLoanSchema;

  // stripUnknown: true removes unrecognised fields (e.g. lenderName sent for a Given loan)
  const { error, value: validatedBody } = schema.validate(req.body, { stripUnknown: true, abortEarly: true });
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const user = await User.findById(req.user.userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const hasBranchAccess = user.role === 'Owner' || (user.branchIds && user.branchIds.some(bId => bId.toString() === req.body.branchId));
    if (!hasBranchAccess) return res.status(403).json({ message: 'Branch not accessible' });

    const loanData = {
      orgId: req.user.orgId,
      createdBy: req.user.userId,
      updatedBy: req.user.userId,
      balance: validatedBody.principal,
      status: 'Pending',
      ...validatedBody
    };

    const loan = await loanService.createLoan(loanData);
    res.status(201).json(loan);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateLoan = async (req, res) => {
  const { error } = updateLoanSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const loan = await loanService.updateLoan(req.user.orgId, req.params.id, { ...req.body, updatedBy: req.user.userId });
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    res.json(loan);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getLoan = async (req, res) => {
  try {
    const loan = await loanService.getLoanById(req.user.orgId, req.params.id);
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    res.json(loan);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listLoans = async (req, res) => {
  try {
    const { branchId, status, direction } = req.query;
    const query = {};
    if (branchId) query.branchId = branchId;
    if (status) query.status = status;
    if (direction) {
      // Existing loans in the DB may not have 'direction' set yet (legacy data).
      // Treat loans with no direction field as 'Given' (the original default).
      if (direction === 'Given') {
        query.direction = { $in: ['Given', null, undefined] };
      } else {
        query.direction = direction;
      }
    }
    const loans = await loanService.listLoans(req.user.orgId, query);
    res.json(loans);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const recordPaymentSchema = Joi.object({
  amount: Joi.number().min(0).required(),
  date: Joi.date().optional()
});

const recordPayment = async (req, res) => {
  const { error } = recordPaymentSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const { amount, date } = req.body;
    const loan = await loanService.recordPayment(req.user.orgId, req.params.id, amount, date ? new Date(date) : new Date());
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    res.json(loan);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createLoan, updateLoan, getLoan, listLoans, recordPayment };
