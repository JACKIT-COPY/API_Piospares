const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String, required: true },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    action: { type: String, required: true }, // e.g. 'UPDATE_USER', 'SUSPEND_ORG'
    target: { type: String },                 // e.g. 'User:abc123', 'Org:def456'
    details: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
