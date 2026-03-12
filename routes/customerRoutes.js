const express = require('express');
const {
    createCustomer,
    listCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer
} = require('../controllers/customerController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Customers
 *   description: Customer management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Customer:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *         email:
 *           type: string
 *         phone:
 *           type: string
 *         address:
 *           type: string
 */

router.post('/', authMiddleware, roleMiddleware(['Owner', 'Manager', 'Cashier', 'SuperManager']), createCustomer);
router.get('/', authMiddleware, roleMiddleware(['Owner', 'Manager', 'Cashier', 'SuperManager']), listCustomers);
router.get('/top-this-month', authMiddleware, roleMiddleware(['Owner', 'Manager', 'Cashier', 'SuperManager']), require('../controllers/customerController').getTopCustomerThisMonth);
router.get('/:id', authMiddleware, roleMiddleware(['Owner', 'Manager', 'Cashier', 'SuperManager']), getCustomerById);
router.put('/:id', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), updateCustomer);
router.delete('/:id', authMiddleware, roleMiddleware(['Owner', 'SuperManager']), deleteCustomer);

module.exports = router;
