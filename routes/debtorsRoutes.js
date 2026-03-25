const express = require('express');
const { getDebtorsSummary, getDebtorSales, getAllPendingSales } = require('../controllers/debtorsController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Debtors
 *   description: Customer debts / pending payments tracking
 */

/**
 * @swagger
 * /debtors/summary:
 *   get:
 *     summary: Get debtors summary grouped by customer
 *     tags: [Debtors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Debtors summary with stats
 */
router.get('/summary', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), getDebtorsSummary);

/**
 * @swagger
 * /debtors/all-sales:
 *   get:
 *     summary: List all pending sales (flat list)
 *     tags: [Debtors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of all pending sales
 */
router.get('/all-sales', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), getAllPendingSales);

/**
 * @swagger
 * /debtors/{customerId}/sales:
 *   get:
 *     summary: List pending sales for a specific customer
 *     tags: [Debtors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pending sales for customer
 */
router.get('/:customerId/sales', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), getDebtorSales);

module.exports = router;
