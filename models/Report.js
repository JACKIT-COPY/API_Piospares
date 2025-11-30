// models/Report.js
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  // branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  periodType: { type: String, enum: ['daily', 'weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly'], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  module: { type: String, enum: ['inventory', 'sales', 'procurement', 'expenses', 'all'], required: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  generatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, index: { expires: '7d' } } // Auto-delete after 7 days
});

// Keep branchId as part of the unique index so caching differs per branch
reportSchema.index({ orgId: 1, branchId: 1, periodType: 1, startDate: 1, module: 1 }, { unique: true, partialFilterExpression: { orgId: { $exists: true } } });

module.exports = mongoose.model('Report', reportSchema);