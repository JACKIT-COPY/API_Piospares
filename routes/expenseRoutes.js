const express = require('express');
const { createExpense, listExpenses, updateExpense, deleteExpense, getExpenseSummary } = require('../controllers/expenseController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ExpenseCreate:
 *       type: object
 *       required:
 *         - branchId
 *         - category
 *         - subCategory
 *         - amount
 *         - dateIncurred
 *       properties:
 *         branchId:
 *           type: string
 *         category:
 *           type: string
 *           enum: [Operating, Employee, Procurement, SalesMarketing, FinancialAdministrative, LogisticsTransportation, CapitalFixed, Miscellaneous]
 *         subCategory:
 *           type: string
 *         amount:
 *           type: number
 *         description:
 *           type: string
 *         dateIncurred:
 *           type: string
 *           format: date
 *         status:
 *           type: string
 *           enum: [Pending, Paid, Overdue]
 *         paymentMethod:
 *           type: string
 *           enum: [Cash, BankTransfer, MobilePayment, Credit]
 */

/**
 * @swagger
 * /expenses:
 *   post:
 *     summary: Create a new expense
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExpenseCreate'
 *     responses:
 *       201:
 *         description: Expense created
 *       400:
 *         description: Bad request
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.post('/', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), createExpense);

/**
 * @swagger
 * /expenses/{id}:
 *   put:
 *     summary: Update an expense
 *     tags: [Expenses]
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
 *             $ref: '#/components/schemas/ExpenseCreate'
 *     responses:
 *       200:
 *         description: Expense updated
 *       400:
 *         description: Bad request
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Expense not found
 *       500:
 *         description: Server error
 */
router.put('/:id', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), updateExpense);

/**
 * @swagger
 * /expenses/{id}:
 *   delete:
 *     summary: Delete an expense
 *     tags: [Expenses]
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
 *         description: Expense deleted
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Expense not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), deleteExpense);

/**
 * @swagger
 * /expenses:
 *   get:
 *     summary: List expenses for organization
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: subCategory
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
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
 *         description: List of expenses
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get('/', authMiddleware, roleMiddleware(['Owner', 'Manager', 'Cashier', 'SuperManager']), listExpenses);

/**
 * @swagger
 * /expenses/summary:
 *   get:
 *     summary: Get expense summary
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [category, subCategory, branchId, month]
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
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
 *         description: Expense summary
 *       400:
 *         description: Bad request
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get('/summary', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), getExpenseSummary);

module.exports = router;