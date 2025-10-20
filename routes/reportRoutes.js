const express = require('express');
const { getSalesSummary, getInventorySummary, getExpensesSummary, getProcurementSummary, exportReport } = require('../controllers/reportController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

/**
 * @swagger
 * /reports/sales-summary:
 *   get:
 *     summary: Get sales summary for reports
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *       - in: query
 *         name: time
 *         schema:
 *           type: string
 *           enum: [today, week, month, year]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Sales summary
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/sales-summary', authMiddleware, roleMiddleware(['Owner', 'Manager', 'Cashier', 'SuperManager']), getSalesSummary);
router.get('/inventory-summary', authMiddleware, roleMiddleware(['Owner', 'Manager', 'Cashier', 'SuperManager']), getInventorySummary);
router.get('/expenses-summary', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), getExpensesSummary);
router.get('/procurement-summary', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), getProcurementSummary);

/**
 * @swagger
 * /reports/export/{type}:
 *   get:
 *     summary: Export report data as CSV
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         schema:
 *           type: string
 *           enum: [sales, inventory, expenses, procurement]
 *         required: true
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *       - in: query
 *         name: time
 *         schema:
 *           type: string
 *           enum: [today, week, month, year]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/export/:type', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), exportReport);

module.exports = router;