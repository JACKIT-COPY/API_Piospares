const mongoose = require('mongoose');

const poSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  status: { type: String, enum: ['pending', 'ordered', 'received', 'cancelled', 'completed'], default: 'pending' },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    buyingPrice: { type: Number, required: true, min: 0 },
    receivedQuantity: { type: Number, default: 0, min: 0 }
  }],
  totalCost: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, default: 0, min: 0 },
  pendingAmount: { type: Number, default: 0, min: 0 },
  notes: { type: String },
  isDeleted: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

poSchema.index({ orgId: 1, supplierId: 1 });

poSchema.pre('save', function(next) {
  if (this.isNew && this.createdBy) {
    this.updatedBy = this.createdBy;
  }
  next();
});

module.exports = mongoose.model('PurchaseOrder', poSchema);