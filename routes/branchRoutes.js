const express = require('express');
const { createBranch, listBranches } = require('../controllers/branchController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     BranchCreate:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *         location:
 *           type: string
 */

/**
 * @swagger
 * /branches:
 *   post:
 *     summary: Create a new branch
 *     tags: [Branches]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BranchCreate'
 *     responses:
 *       201:
 *         description: Branch created
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.post('/', authMiddleware, roleMiddleware(['Owner', 'Manager']), createBranch);

/**
 * @swagger
 * /branches:
 *   get:
 *     summary: List branches for organization
 *     tags: [Branches]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of branches
 *       500:
 *         description: Server error
 */
router.get('/', authMiddleware, roleMiddleware(['Owner', 'Manager']), listBranches);

module.exports = router;