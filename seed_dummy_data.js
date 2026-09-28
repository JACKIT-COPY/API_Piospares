const mongoose = require('mongoose');
require('dotenv').config();

const Organization = require('./models/Organization');
const Branch = require('./models/Branch');
const User = require('./models/User');
const Category = require('./models/Category');
const Product = require('./models/Product');
const Sale = require('./models/Sale');
const Expense = require('./models/Expense');
const Supplier = require('./models/Supplier');
const PurchaseOrder = require('./models/PurchaseOrder');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/piospares');
    console.log('MongoDB connected');

    const org = await Organization.findOne();
    if (!org) {
      console.log('No organization found. Please run seed_org.js first.');
      process.exit(1);
    }
    
    const branch = await Branch.findOne({ orgId: org._id });
    const user = await User.findOne({ orgId: org._id });

    if (!branch || !user) {
      console.log('Missing branch or user for the organization.');
      process.exit(1);
    }

    console.log(`Seeding data for Organization: ${org.name}...`);

    // 1. Create Categories
    const catEngine = await Category.findOneAndUpdate(
      { name: 'Engine Parts', orgId: org._id },
      { name: 'Engine Parts', orgId: org._id, createdBy: user._id },
      { upsert: true, new: true }
    );
    const catBrakes = await Category.findOneAndUpdate(
      { name: 'Braking System', orgId: org._id },
      { name: 'Braking System', orgId: org._id, createdBy: user._id },
      { upsert: true, new: true }
    );
    console.log('Categories created.');

    // 2. Create Suppliers
    const supplier1 = await Supplier.findOneAndUpdate(
      { name: 'Global Auto Spares', orgId: org._id },
      { 
        name: 'Global Auto Spares', orgId: org._id, 
        contactEmail: 'sales@globalauto.com', contactPhone: '+254711111111', 
        address: 'Industrial Area, Nairobi', createdBy: user._id 
      },
      { upsert: true, new: true }
    );
    console.log('Suppliers created.');

    // 3. Create Products
    const prod1 = await Product.findOneAndUpdate(
      { name: 'Spark Plug Bosch', orgId: org._id },
      {
        orgId: org._id, branchId: branch._id, categoryId: catEngine._id,
        name: 'Spark Plug Bosch', description: 'High performance spark plug',
        price: 800, buyingPrice: 500, stock: 150, minStock: 20, createdBy: user._id
      },
      { upsert: true, new: true }
    );

    const prod2 = await Product.findOneAndUpdate(
      { name: 'Ceramic Brake Pads', orgId: org._id },
      {
        orgId: org._id, branchId: branch._id, categoryId: catBrakes._id,
        name: 'Ceramic Brake Pads', description: 'Durable ceramic brake pads',
        price: 3500, buyingPrice: 2000, stock: 50, minStock: 10, createdBy: user._id
      },
      { upsert: true, new: true }
    );
    console.log('Products created.');

    // 4. Create Sales
    const sale1 = new Sale({
      orgId: org._id, branchId: branch._id, userId: user._id,
      products: [
        { productId: prod1._id, name: prod1.name, price: prod1.price, quantity: 4 }
      ],
      total: prod1.price * 4,
      discount: 0,
      paymentMethod: 'mpesa',
      status: 'completed'
    });
    await sale1.save();

    const sale2 = new Sale({
      orgId: org._id, branchId: branch._id, userId: user._id,
      products: [
        { productId: prod2._id, name: prod2.name, price: prod2.price, quantity: 2 },
        { productId: prod1._id, name: prod1.name, price: prod1.price, quantity: 1 }
      ],
      total: (prod2.price * 2) + prod1.price,
      discount: 200,
      paymentMethod: 'cash',
      status: 'completed'
    });
    await sale2.save();
    console.log('Sales created.');

    // 5. Create Expenses (Payroll, Operating)
    const expense1 = new Expense({
      orgId: org._id, branchId: branch._id,
      category: 'Employee', subCategory: 'Payroll',
      amount: 45000, description: 'Monthly salary for cashier',
      dateIncurred: new Date(),
      status: 'Paid', paymentMethod: 'BankTransfer',
      createdBy: user._id
    });
    await expense1.save();

    const expense2 = new Expense({
      orgId: org._id, branchId: branch._id,
      category: 'Operating', subCategory: 'Electricity',
      amount: 3500, description: 'Power bill for October',
      dateIncurred: new Date(),
      status: 'Paid', paymentMethod: 'MobilePayment',
      createdBy: user._id
    });
    await expense2.save();
    console.log('Expenses created.');

    // 6. Create PurchaseOrder (Procurement)
    const po1 = new PurchaseOrder({
      orgId: org._id, supplierId: supplier1._id, branchId: branch._id,
      status: 'ordered',
      items: [
        { productId: prod2._id, quantity: 50, buyingPrice: 2000, receivedQuantity: 0 }
      ],
      totalCost: 50 * 2000,
      notes: 'Urgent stock refill for brake pads',
      createdBy: user._id
    });
    await po1.save();
    console.log('Purchase Orders created.');

    console.log('Dummy data seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seed();
