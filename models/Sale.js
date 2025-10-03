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
  paymentMethod: { type: String, enum: ['cash', 'mpesa', 'pending'], required: true },
  status: { type: String, enum: ['completed', 'pending', 'returned'], default: 'completed' },
}, { timestamps: true });

saleSchema.index({ orgId: 1, branchId: 1, userId: 1 });

module.exports = mongoose.model('Sale', saleSchema);