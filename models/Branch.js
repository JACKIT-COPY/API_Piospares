const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  name: { type: String, required: true },
  location: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Branch', branchSchema);