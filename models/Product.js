const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  stock: { type: Number, required: true },
  minStock: { type: Number, required: true }
}, { timestamps: true });

productSchema.index({ orgId: 1, branchId: 1 });

module.exports = mongoose.model('Product', productSchema);