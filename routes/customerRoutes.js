const express = require('express');
const { listCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer } = require('../controllers/customerController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/', authMiddleware, roleMiddleware(['Owner', 'Manager', 'Cashier', 'SuperManager']), listCustomers);
router.get('/:id', authMiddleware, roleMiddleware(['Owner', 'Manager', 'Cashier', 'SuperManager']), getCustomer);
router.post('/', authMiddleware, roleMiddleware(['Owner', 'Manager', 'Cashier', 'SuperManager']), createCustomer);
router.put('/:id', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), updateCustomer);
router.delete('/:id', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), deleteCustomer);

module.exports = router;
