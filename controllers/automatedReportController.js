const mongoose = require('mongoose');
const ReportSchedule = require('../models/ReportSchedule');
const ReportLog = require('../models/ReportLog');
const { salesReport, expensesReport, inventoryReport, procurementReport } = require('./reportController');
const { sendEmail, generateReportEmailTemplate } = require('../services/emailService');
const { calculateNextSendDate, getCountdownDisplay, getFrequencyLabel } = require('../utils/reportScheduler');

/**
 * Create a new report schedule
 */
const createSchedule = async (req, res) => {
  try {
    const { reportTypes, frequency, dayOfWeek, dayOfMonth, sendTime, email, branchId, timezone, notes } = req.body;
    const userId = req.user.userId;
    const orgId = req.user.orgId;

    // Validate inputs
    if (!reportTypes || reportTypes.length === 0) {
      return res.status(400).json({ message: 'At least one report type must be selected' });
    }
    if (!frequency || !['daily', 'weekly', 'monthly'].includes(frequency)) {
      return res.status(400).json({ message: 'Frequency must be daily, weekly, or monthly' });
    }
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Create schedule
    const schedule = new ReportSchedule({
      userId,
      orgId,
      branchId: branchId || null,
      reportTypes,
      frequency,
      dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : 1,
      dayOfMonth: dayOfMonth !== undefined ? dayOfMonth : 1,
      sendTime: sendTime || '09:00',
      email,
      timezone: timezone || 'Africa/Nairobi',
      notes
    });

    // Calculate next send date
    schedule.nextSendDate = calculateNextSendDate(schedule);

    await schedule.save();

    res.status(201).json({
      message: 'Report schedule created successfully',
      schedule: schedule.toObject()
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get all schedules for user's organization
 */
const getSchedules = async (req, res) => {
  try {
    const userId = req.user.userId;
    const orgId = req.user.orgId;

    const schedules = await ReportSchedule.find({ userId, orgId }).sort('-createdAt');

    // Add countdown info to each schedule
    const schedulesWithCountdown = schedules.map(schedule => {
      const obj = schedule.toObject();
      obj.countdown = getCountdownDisplay(schedule.nextSendDate);
      obj.frequencyLabel = getFrequencyLabel(schedule.frequency, schedule.dayOfWeek, schedule.dayOfMonth);
      return obj;
    });

    res.json(schedulesWithCountdown);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get single schedule by ID
 */
const getScheduleById = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const userId = req.user.userId;
    const orgId = req.user.orgId;

    const schedule = await ReportSchedule.findOne({
      _id: scheduleId,
      userId,
      orgId
    });

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    const obj = schedule.toObject();
    obj.countdown = getCountdownDisplay(schedule.nextSendDate);
    obj.frequencyLabel = getFrequencyLabel(schedule.frequency, schedule.dayOfWeek, schedule.dayOfMonth);

    res.json(obj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update a report schedule
 */
const updateSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const userId = req.user.userId;
    const orgId = req.user.orgId;
    const updates = req.body;

    const schedule = await ReportSchedule.findOne({
      _id: scheduleId,
      userId,
      orgId
    });

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    // Update fields
    Object.assign(schedule, updates);

    // Recalculate next send date if relevant fields changed
    if (updates.sendTime || updates.frequency || updates.dayOfWeek || updates.dayOfMonth) {
      schedule.nextSendDate = calculateNextSendDate(schedule);
    }

    await schedule.save();

    const obj = schedule.toObject();
    obj.countdown = getCountdownDisplay(schedule.nextSendDate);
    obj.frequencyLabel = getFrequencyLabel(schedule.frequency, schedule.dayOfWeek, schedule.dayOfMonth);

    res.json({
      message: 'Schedule updated successfully',
      schedule: obj
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete a report schedule
 */
const deleteSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const userId = req.user.userId;
    const orgId = req.user.orgId;

    const schedule = await ReportSchedule.findOneAndDelete({
      _id: scheduleId,
      userId,
      orgId
    });

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    res.json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get countdown info for a schedule
 */
const getCountdown = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const userId = req.user.userId;
    const orgId = req.user.orgId;

    const schedule = await ReportSchedule.findOne({
      _id: scheduleId,
      userId,
      orgId
    });

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    const countdown = getCountdownDisplay(schedule.nextSendDate);

    res.json({
      scheduleId: schedule._id,
      nextSendDate: schedule.nextSendDate,
      countdown
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Manually trigger report send (for testing)
 */
const triggerReportSend = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const userId = req.user.userId;
    const orgId = req.user.orgId;

    const schedule = await ReportSchedule.findOne({
      _id: scheduleId,
      userId,
      orgId
    });

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    // Collect report data
    const reportData = {};
    
    if (schedule.reportTypes.includes('sales')) {
      reportData.sales = await salesReport(orgId, schedule.branchId, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date());
    }
    
    if (schedule.reportTypes.includes('expenses')) {
      reportData.expenses = await expensesReport(orgId, schedule.branchId, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date());
    }
    
    if (schedule.reportTypes.includes('inventory')) {
      reportData.inventory = await inventoryReport(orgId, schedule.branchId, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date());
    }
    
    if (schedule.reportTypes.includes('procurement')) {
      reportData.procurement = await procurementReport(orgId, schedule.branchId, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date());
    }

    // Generate email
    const org = await require('../models/Organization').findById(orgId);
    const subject = `${getFrequencyLabel(schedule.frequency, schedule.dayOfWeek, schedule.dayOfMonth)} Report - ${new Date().toLocaleDateString()}`;
    const htmlContent = generateReportEmailTemplate(reportData, org.name, schedule.reportTypes);

    // Send email
    const emailResult = await sendEmail(orgId, schedule.email, subject, htmlContent);

    // Log the send
    if (emailResult.success) {
      await ReportLog.create({
        scheduleId: schedule._id,
        userId,
        orgId,
        branchId: schedule.branchId,
        reportTypes: schedule.reportTypes,
        email: schedule.email,
        status: 'success',
        notificationId: emailResult.notificationId,
        summary: {
          salesCount: reportData.sales?.totalSales || 0,
          expensesCount: reportData.expenses?.count || 0,
          totalRevenue: reportData.sales?.totalRevenue || 0,
          totalExpenses: reportData.expenses?.totalExpenses || 0
        }
      });

      res.json({
        message: 'Report sent successfully',
        notificationId: emailResult.notificationId
      });
    } else {
      await ReportLog.create({
        scheduleId: schedule._id,
        userId,
        orgId,
        branchId: schedule.branchId,
        reportTypes: schedule.reportTypes,
        email: schedule.email,
        status: 'failed',
        errorMessage: emailResult.message
      });

      res.status(500).json({
        message: 'Failed to send report',
        error: emailResult.message
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get report send history/logs
 */
const getReportLogs = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const userId = req.user.userId;
    const orgId = req.user.orgId;
    const limit = parseInt(req.query.limit) || 10;

    // Verify schedule belongs to user
    const schedule = await ReportSchedule.findOne({
      _id: scheduleId,
      userId,
      orgId
    });

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    const logs = await ReportLog.find({
      scheduleId,
      orgId
    })
      .sort('-createdAt')
      .limit(limit)
      .lean();

    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createSchedule,
  getSchedules,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
  getCountdown,
  triggerReportSend,
  getReportLogs
};
