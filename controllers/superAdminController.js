const Organization = require('../models/Organization');
const User = require('../models/User');
const Branch = require('../models/Branch');
const ActivityLog = require('../models/ActivityLog');
const { logActivity } = require('../utils/activityLogger');
const bcrypt = require('bcryptjs');
const Joi = require('joi');

// Validation schemas
const orgUpdateSchema = Joi.object({
    name: Joi.string().min(3).max(100).optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().optional(),
    address: Joi.string().optional(),
    plan: Joi.string().valid('Free', 'Basic', 'Premium').optional(),
    status: Joi.string().valid('Active', 'Suspended', 'Inactive').optional(),
    notes: Joi.string().allow('').optional()
});

const userUpdateSchema = Joi.object({
    name: Joi.string().min(2).max(50).optional(),
    email: Joi.string().email().optional(),
    role: Joi.string().valid('SuperAdmin', 'Owner', 'SuperManager', 'Manager', 'Cashier').optional(),
    status: Joi.string().valid('Active', 'On Leave', 'Inactive').optional(),
    branchIds: Joi.array().items(Joi.string()).optional()
});

/**
 * @desc    Get global platform stats
 * @route   GET /super-admin/stats
 */
const getPlatformStats = async (req, res) => {
    try {
        const [totalOrgs, totalUsers, totalBranches] = await Promise.all([
            Organization.countDocuments(),
            User.countDocuments(),
            Branch.countDocuments()
        ]);

        res.json({
            totalOrgs,
            totalUsers,
            totalBranches,
            health: '99.9%' // Placeholder for real health check
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * @desc    List all organizations
 * @route   GET /super-admin/organizations
 */
const getAllOrganizations = async (req, res) => {
    try {
        const { search, status, plan } = req.query;
        const query = {};
        if (search) query.name = { $regex: search, $options: 'i' };
        if (status) query.status = status;
        if (plan) query.plan = plan;

        const orgs = await Organization.find(query).sort({ createdAt: -1 }).lean();

        // Enrich with counts
        const enrichedOrgs = await Promise.all(orgs.map(async (org) => {
            const [branchCount, userCount] = await Promise.all([
                Branch.countDocuments({ orgId: org._id }),
                User.countDocuments({ orgId: org._id })
            ]);
            return { ...org, branchCount, userCount };
        }));

        res.json(enrichedOrgs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * @desc    Get org details
 * @route   GET /super-admin/organizations/:id
 */
const getOrganizationById = async (req, res) => {
    try {
        const org = await Organization.findById(req.params.id).lean();
        if (!org) return res.status(404).json({ message: 'Organization not found' });

        const [branches, users] = await Promise.all([
            Branch.find({ orgId: org._id }).lean(),
            User.find({ orgId: org._id }).select('-passwordHash').lean()
        ]);

        res.json({ ...org, branches, users });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * @desc    Update organization
 * @route   PUT /super-admin/organizations/:id
 */
const updateOrganization = async (req, res) => {
    const { error } = orgUpdateSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    try {
        const org = await Organization.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!org) return res.status(404).json({ message: 'Organization not found' });

        await logActivity({
            actor: req.user.userId,
            actorRole: req.user.role,
            action: 'UPDATE_ORG',
            target: `Org:${org._id}`,
            details: req.body,
            ip: req.ip
        });

        res.json(org);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * @desc    Suspend / Reactivate Organization
 */
const toggleOrgStatus = async (req, res) => {
    const { status } = req.body; // 'Suspended' or 'Active'
    if (!['Active', 'Suspended'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    try {
        const update = {
            status,
            suspendedAt: status === 'Suspended' ? new Date() : null,
            suspendedBy: status === 'Suspended' ? req.user.userId : null
        };

        const org = await Organization.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!org) return res.status(404).json({ message: 'Organization not found' });

        await logActivity({
            actor: req.user.userId,
            actorRole: req.user.role,
            action: status === 'Suspended' ? 'SUSPEND_ORG' : 'REACTIVATE_ORG',
            target: `Org:${org._id}`,
            ip: req.ip
        });

        res.json(org);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * @desc    List all users across all orgs
 */
const getAllUsers = async (req, res) => {
    try {
        const { role, status, orgId } = req.query;
        const query = {};
        if (role) query.role = role;
        if (status) query.status = status;
        if (orgId) query.orgId = orgId;

        const users = await User.find(query)
            .populate('orgId', 'name')
            .select('-passwordHash')
            .sort({ createdAt: -1 })
            .lean();

        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * @desc    Update any user
 */
const updateAnyUser = async (req, res) => {
    const { error } = userUpdateSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-passwordHash');
        if (!user) return res.status(404).json({ message: 'User not found' });

        await logActivity({
            actor: req.user.userId,
            actorRole: req.user.role,
            action: 'UPDATE_USER',
            target: `User:${user._id}`,
            details: req.body,
            ip: req.ip
        });

        res.json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * @desc    Get activity logs
 */
const getActivityLogs = async (req, res) => {
    try {
        const logs = await ActivityLog.find()
            .populate('actor', 'name email')
            .populate('orgId', 'name')
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();
        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * @desc    List all branches across all orgs
 */
const getAllBranches = async (req, res) => {
    try {
        const { orgId } = req.query;
        const query = {};
        if (orgId) query.orgId = orgId;

        const branches = await Branch.find(query)
            .populate('orgId', 'name')
            .sort({ createdAt: -1 })
            .lean();

        res.json(branches);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    getPlatformStats,
    getAllOrganizations,
    getOrganizationById,
    updateOrganization,
    toggleOrgStatus,
    getAllUsers,
    updateAnyUser,
    getActivityLogs,
    getAllBranches
};
