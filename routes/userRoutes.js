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
 *         branchId:
 *           type: string
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
 *     responses:
 *       200:
 *         description: List of users
 *       500:
 *         description: Server error
 */
router.get('/', authMiddleware, roleMiddleware(['Owner', 'Manager']), listUsers);

module.exports = router;