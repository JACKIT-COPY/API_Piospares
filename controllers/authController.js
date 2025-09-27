const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Organization = require('../models/organization');
const Branch = require('../models/Branch');
const User = require('../models/User');

// @desc    Register new organization, main branch, and owner
// @route   POST /auth/register
// @access  Public
const register = async (req, res) => {
  const { orgName, orgEmail, orgPhone, orgAddress, ownerName, ownerEmail, ownerPassword } = req.body;

  try {
    // Check if org or user exists
    let org = await Organization.findOne({ email: orgEmail });
    if (org) return res.status(400).json({ message: 'Organization already exists' });

    let user = await User.findOne({ email: ownerEmail });
    if (user) return res.status(400).json({ message: 'User already exists' });

    // Create organization
    org = new Organization({ name: orgName, email: orgEmail, phone: orgPhone, address: orgAddress });
    await org.save();

    // Create main branch
    const mainBranch = new Branch({ orgId: org._id, name: 'Main Branch', location: orgAddress });
    await mainBranch.save();

    // Hash password and create owner
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(ownerPassword, salt);

    user = new User({
      orgId: org._id,
      branchId: mainBranch._id,
      name: ownerName,
      email: ownerEmail,
      passwordHash,
      role: 'Owner'
    });
    await user.save();

    // Generate JWT
    const payload = { userId: user._id, orgId: org._id, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({ token, message: 'Organization registered successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Login user and get JWT
// @route   POST /auth/login
// @access  Public
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const payload = { userId: user._id, orgId: user.orgId, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { register, login };