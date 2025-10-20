const express = require('express');
const { getOrganization, updateOrganization } = require('../controllers/organizationController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     OrganizationUpdate:
 *       type: object
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

/**
 * @swagger
 * /organizations:
 *   get:
 *     summary: Get organization details
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Organization details
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.get('/', authMiddleware, roleMiddleware(['Owner']), getOrganization);

/**
 * @swagger
 * /organizations:
 *   put:
 *     summary: Update organization details
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OrganizationUpdate'
 *     responses:
 *       200:
 *         description: Updated organization
 *       400:
 *         description: Bad request
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.put('/', authMiddleware, roleMiddleware(['Owner']), updateOrganization);

module.exports = router;