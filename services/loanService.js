const Loan = require('../models/Loan');

const createLoan = async (loanData) => {
  const loan = new Loan(loanData);
  return loan.save();
};

const getLoanById = async (orgId, id) => {
  return Loan.findOne({ _id: id, orgId, isDeleted: false }).lean();
};

const listLoans = async (orgId, query = {}) => {
  return Loan.find({ orgId, isDeleted: false, ...query }).lean();
};

const updateLoan = async (orgId, id, updates) => {
  return Loan.findOneAndUpdate({ _id: id, orgId, isDeleted: false }, { ...updates }, { new: true, runValidators: true });
};

const recordPayment = async (orgId, loanId, paymentAmount, paymentDate = new Date()) => {
  const loan = await Loan.findOne({ _id: loanId, orgId, isDeleted: false });
  if (!loan) return null;

  // reduce balance
  loan.balance = Math.max(0, (loan.balance || 0) - paymentAmount);

  // mark installments as paid if covered
  let remaining = paymentAmount;
  for (const inst of loan.installments) {
    if (remaining <= 0) break;
    if (!inst.paid) {
      const pay = Math.min(remaining, inst.amount);
      if (pay >= inst.amount) {
        inst.paid = true;
        inst.paidAt = paymentDate;
        remaining -= inst.amount;
      } else {
        // partial payment - leave as unpaid for now
        remaining = 0;
      }
    }
  }

  if (loan.balance <= 0) loan.status = 'Paid';

  loan.updatedAt = new Date();
  await loan.save();
  return loan;
};

module.exports = { createLoan, getLoanById, listLoans, updateLoan, recordPayment };
