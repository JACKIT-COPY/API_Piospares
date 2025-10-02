const express = require('express');
const { inviteUser, listUsers } = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     UserInvite:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *         - role
 *       properties:
 *         name:
 *           type: string
 *         email:
 *           type: string
 *         password:
 *           type: string
 *         role:
 *           type: string
 *           enum: [Manager, Cashier]
 *         branchIds:
 *           type: array
 *           items:
 *             type: string
 *         status:
 *           type: string
 *           enum: [Active, On Leave, Inactive]
 */

/**
 * @swagger
 * /users/invite:
 *   post:
 *     summary: Invite/add new user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserInvite'
 *     responses:
 *       201:
 *         description: User invited
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id: { type: string }
 *                 orgId: { type: string }
 *                 branchIds: { type: array, items: { type: string } }
 *                 name: { type: string }
 *                 email: { type: string }
 *                 role: { type: string }
 *                 status: { type: string }
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.post('/invite', authMiddleware, roleMiddleware(['Owner', 'Manager']), inviteUser);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List users for organization
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *         description: Filter users by branch ID
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id: { type: string }
 *                   orgId: { type: string }
 *                   branchIds: { type: array, items: { type: string } }
 *                   name: { type: string }
 *                   email: { type: string }
 *                   role: { type: string }
 *                   status: { type: string }
 *                   createdAt: { type: string }
 *       500:
 *         description: Server error
 */
router.get('/', authMiddleware, roleMiddleware(['Owner', 'Manager']), listUsers);

module.exports = router;