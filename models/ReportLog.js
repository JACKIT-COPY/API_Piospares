const mongoose = require('mongoose');

const reportLogSchema = new mongoose.Schema(
  {
    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReportSchedule',
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null
    },
    // Which reports were included
    reportTypes: [String],
    // Email address it was sent to
    email: String,
    // Status of send
    status: {
      type: String,
      enum: ['success', 'pending', 'failed'],
      default: 'pending'
    },
    // Error message if failed
    errorMessage: String,
    // When it was sent
    sentAt: {
      type: Date,
      default: () => new Date()
    },
    // Uniflow notification ID for tracking
    notificationId: String,
    // Summary of what was sent
    summary: {
      salesCount: Number,
      expensesCount: Number,
      inventoryCount: Number,
      procurementCount: Number,
      totalRevenue: Number,
      totalExpenses: Number
    }
  },
  { timestamps: true }
);

// Indexes for efficient querying
reportLogSchema.index({ scheduleId: 1, createdAt: -1 });
reportLogSchema.index({ userId: 1, orgId: 1, createdAt: -1 });
reportLogSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ReportLog', reportLogSchema);
