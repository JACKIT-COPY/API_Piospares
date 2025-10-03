const express = require('express');
const { createProduct, listProducts, updateProduct, deleteProduct } = require('../controllers/productController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ProductCreate:
 *       type: object
 *       required:
 *         - name
 *         - categoryId
 *         - price
 *         - stock
 *         - minStock
 *         - branchId
 *       properties:
 *         name:
 *           type: string
 *         categoryId:
 *           type: string
 *         price:
 *           type: number
 *         stock:
 *           type: number
 *         minStock:
 *           type: number
 *         branchId:
 *           type: string
 *         description:
 *           type: string
 *     ProductUpdate:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         categoryId:
 *           type: string
 *         price:
 *           type: number
 *         stock:
 *           type: number
 *         minStock:
 *           type: number
 *         description:
 *           type: string
 */

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Create a new product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductCreate'
 *     responses:
 *       201:
 *         description: Product created
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.post('/', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), createProduct);

/**
 * @swagger
 * /products/{id}:
 *   put:
 *     summary: Update a product
 *     tags: [Products]
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
 *             $ref: '#/components/schemas/ProductUpdate'
 *     responses:
 *       200:
 *         description: Product updated
 *       400:
 *         description: Bad request
 *       404:
 *         description: Product not found
 *       500:
 *         description: Server error
 */
router.put('/:id', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), updateProduct);

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Delete a product
 *     tags: [Products]
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
 *         description: Product deleted
 *       404:
 *         description: Product not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), deleteProduct);

/**
 * @swagger
 * /products:
 *   get:
 *     summary: List products for organization
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of products
 *       500:
 *         description: Server error
 */
router.get('/', authMiddleware, roleMiddleware(['Owner', 'Manager', 'Cashier', 'SuperManager']), listProducts);

module.exports = router;