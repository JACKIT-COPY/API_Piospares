const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  address: { type: String },
  totalSpent: { type: Number, default: 0 },
  salesVolume: { type: Number, default: 0 },
}, { timestamps: true });

customerSchema.index({ orgId: 1, name: 'text', email: 'text', phone: 'text' });

module.exports = mongoose.model('Customer', customerSchema);
