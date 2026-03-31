const express = require('express');
const { getCreditorsSummary, getCreditorPOs, getAllUnpaidPOs, getPaidPOs } = require('../controllers/creditorsController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Creditors
 *   description: Supplier debts / unpaid purchase orders tracking
 */

/**
 * @swagger
 * /creditors/summary:
 *   get:
 *     summary: Get creditors summary grouped by supplier
 *     tags: [Creditors]
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
 *         description: Creditors summary with stats
 */
router.get('/summary', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), getCreditorsSummary);

/**
 * @swagger
 * /creditors/all-purchase-orders:
 *   get:
 *     summary: List all unpaid purchase orders (flat list)
 *     tags: [Creditors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *       - in: query
 *         name: supplierId
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
 *         description: List of all unpaid POs
 */
router.get('/all-purchase-orders', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), getAllUnpaidPOs);

/**
 * @swagger
 * /creditors/paid:
 *   get:
 *     summary: List all fully-paid purchase orders (statement view)
 *     tags: [Creditors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *       - in: query
 *         name: supplierId
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
 *         description: List of paid POs
 */
router.get('/paid', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), getPaidPOs);

/**
 * @swagger
 * /creditors/{supplierId}/purchase-orders:
 *   get:
 *     summary: List unpaid POs for a specific supplier
 *     tags: [Creditors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: supplierId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Unpaid POs for supplier
 */
router.get('/:supplierId/purchase-orders', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), getCreditorPOs);

module.exports = router;
