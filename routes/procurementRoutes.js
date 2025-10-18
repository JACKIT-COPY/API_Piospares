const express = require('express');
const {
  createSupplier, listSuppliers, updateSupplier, deleteSupplier,
  createPO, listPOs, updatePO, deletePO, receiveGoods
} = require('../controllers/procurementController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     SupplierCreate:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *         contactEmail:
 *           type: string
 *         contactPhone:
 *           type: string
 *         address:
 *           type: string
 *         paymentTerms:
 *           type: string
 *     SupplierUpdate:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         contactEmail:
 *           type: string
 *         contactPhone:
 *           type: string
 *         address:
 *           type: string
 *         paymentTerms:
 *           type: string
 *     POCreate:
 *       type: object
 *       required:
 *         - supplierId
 *         - branchId
 *         - items
 *       properties:
 *         supplierId:
 *           type: string
 *         branchId:
 *           type: string
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               productId:
 *                 type: string
 *               quantity:
 *                 type: number
 *               buyingPrice:
 *                 type: number
 *         notes:
 *           type: string
 *     ReceiveGoods:
 *       type: object
 *       required:
 *         - items
 *       properties:
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               productId:
 *                 type: string
 *               receivedQuantity:
 *                 type: number
 */

/**
 * @swagger
 * /procurement/suppliers:
 *   post:
 *     summary: Create a new supplier
 *     tags: [Procurement]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SupplierCreate'
 *     responses:
 *       201:
 *         description: Supplier created
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/suppliers', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), createSupplier);

/**
 * @swagger
 * /procurement/suppliers/{id}:
 *   put:
 *     summary: Update a supplier
 *     tags: [Procurement]
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
 *             $ref: '#/components/schemas/SupplierUpdate'
 *     responses:
 *       200:
 *         description: Supplier updated
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Supplier not found
 *       500:
 *         description: Server error
 */
router.put('/suppliers/:id', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), updateSupplier);

/**
 * @swagger
 * /procurement/suppliers/{id}:
 *   delete:
 *     summary: Delete a supplier
 *     tags: [Procurement]
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
 *         description: Supplier deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Supplier not found
 *       500:
 *         description: Server error
 */
router.delete('/suppliers/:id', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), deleteSupplier);

/**
 * @swagger
 * /procurement/suppliers:
 *   get:
 *     summary: List suppliers for organization
 *     tags: [Procurement]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of suppliers
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/suppliers', authMiddleware, roleMiddleware(['Owner', 'Manager', 'Cashier', 'SuperManager']), listSuppliers);

/**
 * @swagger
 * /procurement/purchase-orders:
 *   post:
 *     summary: Create a new purchase order
 *     tags: [Procurement]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/POCreate'
 *     responses:
 *       201:
 *         description: PO created
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/purchase-orders', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), createPO);

/**
 * @swagger
 * /procurement/purchase-orders/{id}:
 *   put:
 *     summary: Update a purchase order
 *     tags: [Procurement]
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
 *             $ref: '#/components/schemas/POCreate'
 *     responses:
 *       200:
 *         description: PO updated
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: PO not found
 *       500:
 *         description: Server error
 */
router.put('/purchase-orders/:id', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), updatePO);

/**
 * @swagger
 * /procurement/purchase-orders/{id}:
 *   delete:
 *     summary: Delete a purchase order
 *     tags: [Procurement]
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
 *         description: PO deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: PO not found
 *       500:
 *         description: Server error
 */
router.delete('/purchase-orders/:id', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), deletePO);

/**
 * @swagger
 * /procurement/purchase-orders:
 *   get:
 *     summary: List purchase orders for organization
 *     tags: [Procurement]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: supplierId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of POs
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/purchase-orders', authMiddleware, roleMiddleware(['Owner', 'Manager', 'Cashier', 'SuperManager']), listPOs);

/**
 * @swagger
 * /procurement/purchase-orders/{id}/receive:
 *   post:
 *     summary: Receive goods for a purchase order
 *     tags: [Procurement]
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
 *             $ref: '#/components/schemas/ReceiveGoods'
 *     responses:
 *       200:
 *         description: Goods received
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: PO not found
 *       500:
 *         description: Server error
 */
router.post('/purchase-orders/:id/receive', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), receiveGoods);

module.exports = router;