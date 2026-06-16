const mongoose = require('mongoose');

const installmentSchema = new mongoose.Schema({
  dueDate: { type: Date, required: true },
  amount: { type: Number, required: true },
  paid: { type: Boolean, default: false },
  paidAt: { type: Date }
}, { _id: false });

const loanSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },

  // Direction: 'Given' = org lent money out, 'Received' = org borrowed money
  direction: { type: String, enum: ['Given', 'Received'], default: 'Given' },

  // For "Given" loans (org lends to someone)
  borrowerId: { type: mongoose.Schema.Types.ObjectId, refPath: 'borrowerModel' },
  borrowerModel: { type: String, enum: ['Customer', 'User', 'Supplier'], default: 'Customer' },

  // For "Received" loans (org borrows from someone)
  lenderName: { type: String },
  lenderType: { type: String, enum: ['Supplier', 'Customer', 'User', 'Other'], default: 'Other' },
  lenderId: { type: mongoose.Schema.Types.ObjectId, refPath: 'lenderType' },

  principal: { type: Number, required: true, min: 0 },
  interestRate: { type: Number, required: true, min: 0 },
  termMonths: { type: Number, required: true, min: 1 },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  balance: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['Pending', 'Active', 'Paid', 'Defaulted'], default: 'Pending' },
  installments: { type: [installmentSchema], default: [] },
  isDeleted: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

loanSchema.index({ orgId: 1, branchId: 1, direction: 1 });

module.exports = mongoose.model('Loan', loanSchema);
