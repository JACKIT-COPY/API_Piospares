// models/Sale.js
const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  products: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
  }],

  total: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  paymentMethod: { type: String, enum: ['cash', 'mpesa', 'pending', 'paybill'], required: true },
  status: { type: String, enum: ['completed', 'pending', 'returned'], default: 'completed' },

  // ---- NEW SOFT-DELETE FIELDS ----
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // ---- M-PESA ----
  stkRequestID: { type: String, default: null },
  phoneNumber: { type: String, default: null },
  receiptNumber: { type: String, default: null },
}, { timestamps: true });

saleSchema.index({ orgId: 1, branchId: 1, userId: 1 });
saleSchema.index({ isDeleted: 1, deletedAt: -1 });

module.exports = mongoose.model('Sale', saleSchema);