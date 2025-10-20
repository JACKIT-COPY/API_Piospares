const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  stock: { type: Number, required: true },
  minStock: { type: Number, required: true },
  buyingPrice: { type: Number, min: 0, optional: true },
  imageUrl: { type: String, optional: true },
  isDeleted: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

productSchema.index({ orgId: 1, branchId: 1 });

// Pre-save hook to set createdBy and updatedBy
productSchema.pre('save', function(next) {
  if (this.isNew && this.createdBy) {
    this.updatedBy = this.createdBy;
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);