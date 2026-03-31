const cron = require('node-cron');
const ReportSchedule = require('../models/ReportSchedule');
const ReportLog = require('../models/ReportLog');
const { shouldSendNow, calculateNextSendDate } = require('./reportScheduler');
const { salesReport, expensesReport, inventoryReport, procurementReport } = require('../controllers/reportController');
const { sendEmail, generateReportEmailTemplate } = require('../services/emailService');
const Organization = require('../models/Organization');

let schedulerJob = null;

/**
 * Start the automated report scheduler
 * Runs every minute to check and send pending reports
 */
const startReportScheduler = () => {
  console.log('[ReportScheduler] Starting automated report scheduler...');

  // Run every minute
  schedulerJob = cron.schedule('* * * * *', async () => {
    try {
      // Get all enabled schedules that should send
      const schedules = await ReportSchedule.find({
        isEnabled: true,
        nextSendDate: { $lte: new Date(Date.now() + 5 * 60 * 1000) } // Within 5 minutes
      });

      if (schedules.length === 0) return;

      console.log(`[ReportScheduler] Found ${schedules.length} schedule(s) to process`);

      for (const schedule of schedules) {
        if (shouldSendNow(schedule)) {
          await sendScheduledReport(schedule);
        }
      }
    } catch (error) {
      console.error('[ReportScheduler] Error in scheduler:', error.message);
    }
  });

  console.log('[ReportScheduler] Scheduler started successfully');
};

/**
 * Send a scheduled report
 */
const sendScheduledReport = async (schedule) => {
  let logEntry = null;

  try {
    console.log(`[ReportScheduler] Processing schedule ${schedule._id} for ${schedule.email}`);

    // Collect report data based on report types
    const reportData = {};

    // Determine date range for reports (last week for all types)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date();

    try {
      if (schedule.reportTypes.includes('sales')) {
        reportData.sales = await salesReport(
          schedule.orgId.toString(),
          schedule.branchId ? schedule.branchId.toString() : null,
          startDate,
          endDate
        );
      }

      if (schedule.reportTypes.includes('expenses')) {
        reportData.expenses = await expensesReport(
          schedule.orgId.toString(),
          schedule.branchId ? schedule.branchId.toString() : null,
          startDate,
          endDate
        );
      }

      if (schedule.reportTypes.includes('inventory')) {
        reportData.inventory = await inventoryReport(
          schedule.orgId.toString(),
          schedule.branchId ? schedule.branchId.toString() : null,
          startDate,
          endDate
        );
      }

      if (schedule.reportTypes.includes('procurement')) {
        reportData.procurement = await procurementReport(
          schedule.orgId.toString(),
          schedule.branchId ? schedule.branchId.toString() : null,
          startDate,
          endDate
        );
      }
    } catch (reportError) {
      console.error(`[ReportScheduler] Error generating reports: ${reportError.message}`);
      throw new Error(`Failed to generate reports: ${reportError.message}`);
    }

    // Get organization name for email
    const org = await Organization.findById(schedule.orgId);
    if (!org) {
      throw new Error('Organization not found');
    }

    // Generate email subject and content
    const frequencyLabel = getFrequencyLabel(schedule.frequency, schedule.dayOfWeek, schedule.dayOfMonth);
    const subject = `${frequencyLabel} Report - ${new Date().toLocaleDateString()}`;
    const htmlContent = generateReportEmailTemplate(reportData, org.name, schedule.reportTypes);

    // Create log entry (pending)
    logEntry = await ReportLog.create({
      scheduleId: schedule._id,
      userId: schedule.userId,
      orgId: schedule.orgId,
      branchId: schedule.branchId,
      reportTypes: schedule.reportTypes,
      email: schedule.email,
      status: 'pending',
      summary: {
        salesCount: reportData.sales?.totalSales || 0,
        expensesCount: reportData.expenses?.count || 0,
        totalRevenue: reportData.sales?.totalRevenue || 0,
        totalExpenses: reportData.expenses?.totalExpenses || 0
      }
    });

    // Send email via Uniflow
    console.log(`[ReportScheduler] Sending email to ${schedule.email}...`);
    const emailResult = await sendEmail(schedule.orgId, schedule.email, subject, htmlContent);

    if (emailResult.success) {
      console.log(`[ReportScheduler] Email sent successfully. Notification ID: ${emailResult.notificationId}`);

      // Update log as success
      logEntry.status = 'success';
      logEntry.notificationId = emailResult.notificationId;
      await logEntry.save();

      // Calculate next send date and update schedule
      schedule.nextSendDate = calculateNextSendDate(schedule);
      await schedule.save();

      console.log(`[ReportScheduler] Schedule ${schedule._id} updated. Next send: ${schedule.nextSendDate}`);
    } else {
      throw new Error(emailResult.message || 'Unknown email error');
    }
  } catch (error) {
    console.error(`[ReportScheduler] Failed to send report for schedule ${schedule._id}:`, error.message);

    // Update log as failed
    if (logEntry) {
      logEntry.status = 'failed';
      logEntry.errorMessage = error.message;
      await logEntry.save();
    } else {
      // Create failed log if not already created
      await ReportLog.create({
        scheduleId: schedule._id,
        userId: schedule.userId,
        orgId: schedule.orgId,
        branchId: schedule.branchId,
        reportTypes: schedule.reportTypes,
        email: schedule.email,
        status: 'failed',
        errorMessage: error.message
      });
    }

    // Still calculate next send date so we don't keep failing
    try {
      schedule.nextSendDate = calculateNextSendDate(schedule);
      await schedule.save();
    } catch (updateError) {
      console.error(`[ReportScheduler] Error updating next send date:`, updateError.message);
    }
  }
};

/**
 * Stop the report scheduler
 */
const stopReportScheduler = () => {
  if (schedulerJob) {
    schedulerJob.stop();
    schedulerJob = null;
    console.log('[ReportScheduler] Scheduler stopped');
  }
};

/**
 * Get frequency label helper
 */
const getFrequencyLabel = (frequency, dayOfWeek = null, dayOfMonth = null) => {
  if (frequency === 'weekly') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `Weekly Report (${days[dayOfWeek || 1]})`;
  } else if (frequency === 'monthly') {
    const suffix = (day) => {
      if (day === 1) return 'st';
      if (day === 2) return 'nd';
      if (day === 3) return 'rd';
      return 'th';
    };
    return `Monthly Report (${dayOfMonth || 1}${suffix(dayOfMonth || 1)})`;
  }
  return frequency;
};

module.exports = {
  startReportScheduler,
  stopReportScheduler,
  sendScheduledReport
};
