const mongoose = require('mongoose');

// In models/User.js
const userSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  branchIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }], // Changed to array
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['Owner', 'Manager', 'Cashier'], required: true },
  status: { type: String, enum: ['Active', 'On Leave', 'Inactive'], default: 'Active' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);