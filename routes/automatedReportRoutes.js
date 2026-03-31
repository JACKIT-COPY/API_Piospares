const express = require('express');
const {
  createSchedule,
  getSchedules,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
  getCountdown,
  triggerReportSend,
  getReportLogs
} = require('../controllers/automatedReportController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// CRUD operations for schedules
router.post('/schedules', roleMiddleware(['Owner', 'SuperManager', 'Manager']), createSchedule);
router.get('/schedules', getSchedules);
router.get('/schedules/:scheduleId', getScheduleById);
router.put('/schedules/:scheduleId', roleMiddleware(['Owner', 'SuperManager', 'Manager']), updateSchedule);
router.delete('/schedules/:scheduleId', roleMiddleware(['Owner', 'SuperManager', 'Manager']), deleteSchedule);

// Get countdown for a schedule
router.get('/schedules/:scheduleId/countdown', getCountdown);

// Manually trigger report send (for testing)
router.post('/schedules/:scheduleId/send', roleMiddleware(['Owner', 'SuperManager', 'Manager']), triggerReportSend);

// Get report send history
router.get('/schedules/:scheduleId/logs', getReportLogs);

module.exports = router;
