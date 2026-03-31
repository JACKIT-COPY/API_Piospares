const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    address: { type: String },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

customerSchema.pre('save', function (next) {
    if (this.isNew && this.createdBy) {
        this.updatedBy = this.createdBy;
    }
    next();
});

// Index for faster lookups
customerSchema.index({ orgId: 1, isDeleted: 1 });
customerSchema.index({ phone: 1 });

module.exports = mongoose.model('Customer', customerSchema);
