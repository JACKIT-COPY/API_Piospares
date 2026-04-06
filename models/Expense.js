const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  category: {
    type: String,
    enum: ['Operating', 'Employee', 'Procurement', 'SalesMarketing', 'FinancialAdministrative', 'LogisticsTransportation', 'CapitalFixed', 'Miscellaneous'],
    required: true
  },
  subCategory: {
    type: String,
    required: true
    // Enum can be enforced in validation, but for flexibility, we'll handle in controller based on category
  },
  amount: { type: Number, required: true, min: 0 },
  description: { type: String },
  dateIncurred: { type: Date, required: true },
  status: { type: String, enum: ['Pending', 'Paid', 'Overdue'], default: 'Pending' },
  paymentMethod: { type: String, enum: ['Cash', 'BankTransfer', 'MobilePayment', 'Credit'] },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' }, // Link to supplier for business expenses
  referenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' }, // For procurement links
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For employee wages/dividends
  isDeleted: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

expenseSchema.index({ orgId: 1, branchId: 1 });
expenseSchema.index({ dateIncurred: 1 });
expenseSchema.index({ category: 1, subCategory: 1 });

expenseSchema.pre('save', function (next) {
  if (this.isNew && this.createdBy) {
    this.updatedBy = this.createdBy;
  }
  next();
});

module.exports = mongoose.model('Expense', expenseSchema);