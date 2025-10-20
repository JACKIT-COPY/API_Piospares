const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  name: { type: String, required: true },
  contactEmail: { type: String },
  contactPhone: { type: String },
  address: { type: String },
  paymentTerms: { type: String },
  isDeleted: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

supplierSchema.pre('save', function(next) {
  if (this.isNew && this.createdBy) {
    this.updatedBy = this.createdBy;
  }
  next();
});

module.exports = mongoose.model('Supplier', supplierSchema);