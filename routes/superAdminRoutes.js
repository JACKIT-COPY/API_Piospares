const express = require('express');
const {
    getPlatformStats,
    getAllOrganizations,
    getOrganizationById,
    updateOrganization,
    toggleOrgStatus,
    getAllUsers,
    updateAnyUser,
    getActivityLogs,
    getAllBranches
} = require('../controllers/superAdminController');
const authMiddleware = require('../middlewares/authMiddleware');
const superAdminOnly = require('../middlewares/superAdminMiddleware');

const router = express.Router();

// All routes here require SuperAdmin authentication
router.use(authMiddleware, superAdminOnly);

/**
 * @route   GET /super-admin/stats
 */
router.get('/stats', getPlatformStats);

/**
 * @route   GET /super-admin/organizations
 */
router.get('/organizations', getAllOrganizations);

/**
 * @route   GET /super-admin/organizations/:id
 */
router.get('/organizations/:id', getOrganizationById);

/**
 * @route   PUT /super-admin/organizations/:id
 */
router.put('/organizations/:id', updateOrganization);

/**
 * @route   PATCH /super-admin/organizations/:id/status
 */
router.patch('/organizations/:id/status', toggleOrgStatus);

/**
 * @route   GET /super-admin/users
 */
router.get('/users', getAllUsers);

/**
 * @route   PUT /super-admin/users/:id
 */
router.put('/users/:id', updateAnyUser);

/**
 * @route   GET /super-admin/branches
 */
router.get('/branches', getAllBranches);

/**
 * @route   GET /super-admin/logs
 */
router.get('/logs', getActivityLogs);

module.exports = router;
