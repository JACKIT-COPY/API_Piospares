const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');
const User = require('./models/User');
const Organization = require('./models/Organization');

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

            // Ensure the system organization exists even if admin already exists
            let systemOrg = await Organization.findOne({ email: 'system@piospares.com' });
            if (!systemOrg) {
                systemOrg = new Organization({
                    name: 'System Administration',
                    email: 'system@piospares.com',
                    phone: '',
                    address: 'Platform',
                    status: 'Active',
                    plan: 'Premium',
                    notes: 'Internal system organization for the SuperAdmin. Do not delete.'
                });
                await systemOrg.save();
                console.log('System organization created');
            }

            // If the existing admin doesn't have an orgId, assign the system org
            if (!existingAdmin.orgId) {
                existingAdmin.orgId = systemOrg._id;
                await existingAdmin.save();
                console.log('Linked SuperAdmin to System organization');
            }

            process.exit(0);
        }

        // Create system organization first
        let systemOrg = await Organization.findOne({ email: 'system@piospares.com' });
        if (!systemOrg) {
            systemOrg = new Organization({
                name: 'System Administration',
                email: 'system@piospares.com',
                phone: '',
                address: 'Platform',
                status: 'Active',
                plan: 'Premium',
                notes: 'Internal system organization for the SuperAdmin. Do not delete.'
            });
            await systemOrg.save();
            console.log('System organization created');
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const superAdmin = new User({
            name: 'Platform Admin',
            email,
            passwordHash,
            role: 'SuperAdmin',
            status: 'Active',
            orgId: systemOrg._id  // Assign the system org to the SuperAdmin
        });

        await superAdmin.save();
        console.log('SuperAdmin created successfully');
        console.log('Email:', email);
        console.log('Password:', password);
        console.log('Org:', systemOrg.name);
        process.exit(0);
    } catch (err) {
        console.error('Error seeding SuperAdmin:', err.message);
        process.exit(1);
    }
};

seedSuperAdmin();
