const express = require('express');
const { createBranch, listBranches, updateBranch } = require('../controllers/branchController');
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
 *     BranchUpdate:
 *       type: object
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
 * /branches/{id}:
 *   put:
 *     summary: Update a branch
 *     tags: [Branches]
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
 *             $ref: '#/components/schemas/BranchUpdate'
 *     responses:
 *       200:
 *         description: Branch updated
 *       400:
 *         description: Bad request
 *       404:
 *         description: Branch not found
 *       500:
 *         description: Server error
 */
router.put('/:id', authMiddleware, roleMiddleware(['Owner', 'Manager']), updateBranch);

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