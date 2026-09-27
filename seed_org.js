const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const Organization = require('./models/Organization');
const Branch = require('./models/Branch');
const User = require('./models/User');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    const orgEmail = 'admin@testorg.com';
    const ownerEmail = 'owner@testorg.com';
    const ownerPassword = 'password123';

    // Cleanup first just in case
    await Organization.deleteOne({ email: orgEmail });
    await User.deleteOne({ email: ownerEmail });

    const org = new Organization({
      name: 'Test Organization',
      email: orgEmail,
      phone: '+254700000000',
      address: 'Test Address Nairobi'
    });
    await org.save();
    console.log('Created Organization:', org.name);

    const mainBranch = new Branch({
      orgId: org._id,
      name: 'Main Branch',
      location: org.address
    });
    await mainBranch.save();
    console.log('Created Main Branch');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(ownerPassword, salt);

    const user = new User({
      orgId: org._id,
      branchIds: [mainBranch._id],
      name: 'Test Owner',
      email: ownerEmail,
      passwordHash,
      role: 'Owner'
    });
    await user.save();
    console.log('Created User:', user.name);

    console.log('\n--- Credentials ---');
    console.log('Email:', ownerEmail);
    console.log('Password:', ownerPassword);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seed();
