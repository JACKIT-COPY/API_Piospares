const mongoose = require('mongoose');

const stockTransferRequestSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  sourceBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  destinationBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  requestedBy: {
    userId: mongoose.Schema.Types.ObjectId,
    name: String,
    role: String
  },
  products: [{
    productId: mongoose.Schema.Types.ObjectId,
    name: String,
    categoryId: mongoose.Schema.Types.ObjectId,
    quantityRequested: { type: Number, required: true },
    quantityApproved: { type: Number, default: 0 },
    unitPrice: { type: Number },
    buyingPrice: { type: Number }
  }],
  reason: { type: String },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  requestedAt: { type: Date, default: Date.now },
  approvedAt: { type: Date },
  approvedBy: {
    userId: mongoose.Schema.Types.ObjectId,
    name: String,
    role: String
  },
  approvalNotes: { type: String },
  completedAt: { type: Date },
  history: [{
    action: { type: String, enum: ['Requested', 'Approved', 'Rejected', 'Completed', 'Cancelled'] },
    by: {
      userId: mongoose.Schema.Types.ObjectId,
      name: String,
      role: String
    },
    comment: String,
    timestamp: { type: Date, default: Date.now }
  }],
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

stockTransferRequestSchema.index({ orgId: 1, sourceBranchId: 1, destinationBranchId: 1 });
stockTransferRequestSchema.index({ status: 1, requestedAt: -1 });

module.exports = mongoose.model('StockTransferRequest', stockTransferRequestSchema);
