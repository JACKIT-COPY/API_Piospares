// routes/reportRoutes.js
const express = require('express');
const { getReport } = require('../controllers/reportController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

/**
 * @swagger
 * /reports:
 *   get:
 *     summary: Get comprehensive POS report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: period
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, quarterly, half-yearly, yearly]
 *         description: Time period for the report
 *       - name: date
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: 'Anchor date (YYYY-MM-DD). Default: today'
 *       - name: module
 *         in: query
 *         schema:
 *           type: string
 *           enum: [inventory, sales, procurement, expenses, all]
 *           default: all
 *         description: Module to include
 *     responses:
 *       - name: module
 *         description: Report generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *       - name: branchId
 *         in: query
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Branch id to filter the report (optional). If omitted, report is org-wide.
 *                 period:
 *                   type: object
 *                   properties:
 *                     type: { type: string }
 *                     start: { type: string, format: date-time }
 *                     end: { type: string, format: date-time }
 *       '400':
 *         description: Invalid parameters
 *       '500':
 *         description: Server error
 */
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['Owner', 'Manager', 'SuperManager']),
  getReport
);

module.exports = router;