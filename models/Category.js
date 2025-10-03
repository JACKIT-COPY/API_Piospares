const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  name: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);