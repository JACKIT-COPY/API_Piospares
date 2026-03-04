const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');
const User = require('./models/User');

dotenv.config();

const seedSuperAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const email = 'admin@piospares.com'; // Default SuperAdmin email
        const password = 'Password123!';     // Default SuperAdmin password

        const existingAdmin = await User.findOne({ email });
        if (existingAdmin) {
            console.log('SuperAdmin already exists');
            process.exit(0);
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const superAdmin = new User({
            name: 'Plateform Admin',
            email,
            passwordHash,
            role: 'SuperAdmin',
            status: 'Active'
        });

        await superAdmin.save();
        console.log('SuperAdmin created successfully');
        console.log('Email:', email);
        console.log('Password:', password);
        process.exit(0);
    } catch (err) {
        console.error('Error seeding SuperAdmin:', err.message);
        process.exit(1);
    }
};

seedSuperAdmin();
