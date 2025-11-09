const express = require('express');
const { createSale, listSales, updateSaleStatus, softDeleteSale, listRecentlyDeleted } = require('../controllers/salesController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     SaleCreate:
 *       type: object
 *       required:
 *         - products
 *         - paymentMethod
 *         - branchId
 *       properties:
 *         products:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               productId:
 *                 type: string
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               quantity:
 *                 type: number
 *         discount:
 *           type: number
 *         paymentMethod:
 *           type: string
 *           enum: [cash, mpesa, paybill, pending]
 *         branchId:
 *           type: string
 *     SaleUpdateStatus:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [completed, pending, returned]
 *         paymentMethod:
 *           type: string
 *           enum: [cash, mpesa, paybill]
 */

/**
 * @swagger
 * /sales:
 *   post:
 *     summary: Create a new sale
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SaleCreate'
 *     responses:
 *       201:
 *         description: Sale created
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.post('/', authMiddleware, roleMiddleware(['Owner', 'Manager', 'Cashier', 'SuperManager']), createSale);

/**
 * @swagger
 * /sales:
 *   get:
 *     summary: List sales for organization
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of sales
 *       500:
 *         description: Server error
 */
router.get('/', authMiddleware, roleMiddleware(['Owner', 'Manager', 'Cashier', 'SuperManager']), listSales);

/**
 * @swagger
 * /sales/{id}:
 *   put:
 *     summary: Update sale status
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SaleUpdateStatus'
 *     responses:
 *       200:
 *         description: Sale updated
 *       400:
 *         description: Bad request
 *       404:
 *         description: Sale not found
 *       500:
 *         description: Server error
 */
router.put('/:id', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), updateSaleStatus);

/**
 * @swagger
 * /sales/{id}:
 *   delete:
 *     summary: Soft-delete a sale (Owner/SuperManager only)
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sale soft-deleted
 *       400:
 *         description: Bad request
 *       404:
 *         description: Sale not found
 */

// SOFT-DELETE (Owner / SuperManager only)
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['Owner','SuperManager']),
  softDeleteSale
);

/**
 * @swagger
 * /sales/recently-deleted:
 *   get:
 *     summary: List recently soft-deleted sales (last 30 days)
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of deleted sales
 */

// RECENTLY DELETED (Owner / SuperManager only)
router.get(
  '/recently-deleted',
  authMiddleware,
  roleMiddleware(['Owner','SuperManager']),
  listRecentlyDeleted
);

module.exports = router;