const ActivityLog = require('../models/ActivityLog');

/**
 * Log an activity to the database for auditing
 * @param {Object} params
 * @param {string} params.actor - User ID of the performer
 * @param {string} params.actorRole - Role of the performer
 * @param {string} [params.orgId] - Organization ID if applicable
 * @param {string} params.action - Action performed (e.g. 'SUSPEND_ORG')
 * @param {string} [params.target] - Target of the action
 * @param {Object} [params.details] - Additional JSON metadata
 * @param {string} [params.ip] - IP address of the request
 */
const logActivity = async ({ actor, actorRole, orgId, action, target, details, ip }) => {
    try {
        await ActivityLog.create({ actor, actorRole, orgId, action, target, details, ip });
    } catch (err) {
        console.error('Activity log failed:', err.message);
    }
};

module.exports = { logActivity };
