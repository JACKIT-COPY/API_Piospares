const express = require('express');
const { createLoan, updateLoan, getLoan, listLoans, recordPayment } = require('../controllers/loanController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

/**
 * POST /loans - create a loan
 */
router.post('/', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), createLoan);

/**
 * PUT /loans/:id - update loan
 */
router.put('/:id', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), updateLoan);

/**
 * GET /loans/:id - get single loan
 */
router.get('/:id', authMiddleware, roleMiddleware(['Owner', 'Manager', 'Cashier', 'SuperManager']), getLoan);

/**
 * GET /loans - list loans
 */
router.get('/', authMiddleware, roleMiddleware(['Owner', 'Manager', 'Cashier', 'SuperManager']), listLoans);

/**
 * POST /loans/:id/pay - record a payment
 */
router.post('/:id/pay', authMiddleware, roleMiddleware(['Owner', 'Manager', 'Cashier', 'SuperManager']), recordPayment);

module.exports = router;
