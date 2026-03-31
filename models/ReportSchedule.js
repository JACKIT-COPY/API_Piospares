const mongoose = require('mongoose');

const reportScheduleSchema = new mongoose.Schema(
  {
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
    // Types of reports to include: sales, expenses, inventory, procurement
    reportTypes: {
      type: [String],
      enum: ['sales', 'expenses', 'inventory', 'procurement'],
      required: true,
      default: ['sales']
    },
    // Frequency: daily, weekly or monthly
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: true
    },
    // For weekly: 0-6 (0=Sunday, 6=Saturday)
    dayOfWeek: {
      type: Number,
      min: 0,
      max: 6,
      default: 1 // Monday
    },
    // For monthly: 1-28 (day of month)
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 28,
      default: 1
    },
    // Send time in HH:mm format (e.g., "09:00")
    sendTime: {
      type: String,
      required: true,
      default: '09:00'
    },
    // Email address to send to
    email: {
      type: String,
      required: true
    },
    // Is this schedule active?
    isEnabled: {
      type: Boolean,
      default: true
    },
    // Next scheduled send date (calculated)
    nextSendDate: {
      type: Date,
      default: null
    },
    // Timezone for scheduling (e.g., 'Africa/Nairobi')
    timezone: {
      type: String,
      default: 'Africa/Nairobi'
    },
    // Custom note
    notes: String
  },
  { timestamps: true }
);

// Index for efficient querying
reportScheduleSchema.index({ userId: 1, orgId: 1 });
reportScheduleSchema.index({ isEnabled: 1, nextSendDate: 1 });

module.exports = mongoose.model('ReportSchedule', reportScheduleSchema);
