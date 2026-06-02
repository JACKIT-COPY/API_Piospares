const mongoose = require('mongoose');

// In models/User.js
const userSchema = new mongoose.Schema({
  orgId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Organization', 
    required: function() { return this.role !== 'SuperAdmin'; } 
  },
  branchIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }],
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: function() { return this.role !== 'Shareholder'; } },
  role: { type: String, enum: ['SuperAdmin', 'Owner', 'SuperManager', 'Manager', 'Cashier', 'Accountant', 'Developer', 'Shareholder'], required: true },
  status: { type: String, enum: ['Active', 'On Leave', 'Inactive'], default: 'Active' },
  dailyWage: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);