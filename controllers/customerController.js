const Customer = require('../models/Customer');
const Joi = require('joi');

// Joi validation schema
const customerSchema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().allow('', null),
    phone: Joi.string().allow('', null),
    address: Joi.string().allow('', null),
});

const createCustomer = async (req, res) => {
    try {
        const { error, value } = customerSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0].message });

        const customer = new Customer({
            ...value,
            orgId: req.user.orgId,
            createdBy: req.user.id,
        });

        await customer.save();
        res.status(201).json(customer);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const listCustomers = async (req, res) => {
    try {
        const { search, page = 1, limit = 10, sort = 'name' } = req.query;
        // require mongoose to convert orgId string to ObjectId safely inside listCustomers or use the already imported one if there is
        const mongoose = require('mongoose');
        const query = { orgId: new mongoose.Types.ObjectId(req.user.orgId), isDeleted: false };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        let sortObj = { name: 1 };
        if (sort === 'top_spenders') {
            sortObj = { totalSpent: -1 };
        } else if (sort === 'volume') {
            sortObj = { salesVolume: -1 };
        }

        const pipeline = [
            { $match: query },
            {
                $lookup: {
                    from: 'sales',
                    let: { customerId: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $and: [{ $eq: ['$customerId', '$$customerId'] }, { $ne: ['$isDeleted', true] }] } } }
                    ],
                    as: 'customerSales'
                }
            },
            {
                $addFields: {
                    totalSpent: { $sum: '$customerSales.total' },
                    salesVolume: { $size: '$customerSales' }
                }
            },
            { $project: { customerSales: 0 } },
            { $sort: sortObj },
            { $skip: skip },
            { $limit: limitNum }
        ];

        const customers = await Customer.aggregate(pipeline);
        const count = await Customer.countDocuments(query);

        res.json({
            customers,
            totalPages: Math.ceil(count / limitNum),
            currentPage: pageNum,
            totalCustomers: count,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getCustomerById = async (req, res) => {
    try {
        const customer = await Customer.findOne({ _id: req.params.id, orgId: req.user.orgId, isDeleted: false });
        if (!customer) return res.status(404).json({ message: 'Customer not found' });
        res.json(customer);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const updateCustomer = async (req, res) => {
    try {
        const { error, value } = customerSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0].message });

        const customer = await Customer.findOneAndUpdate(
            { _id: req.params.id, orgId: req.user.orgId, isDeleted: false },
            { ...value, updatedBy: req.user.id },
            { new: true }
        );

        if (!customer) return res.status(404).json({ message: 'Customer not found' });
        res.json(customer);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const deleteCustomer = async (req, res) => {
    try {
        const customer = await Customer.findOneAndUpdate(
            { _id: req.params.id, orgId: req.user.orgId, isDeleted: false },
            { isDeleted: true, updatedBy: req.user.id },
            { new: true }
        );

        if (!customer) return res.status(404).json({ message: 'Customer not found' });
        res.json({ message: 'Customer deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getTopCustomerThisMonth = async (req, res) => {
    try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const mongoose = require('mongoose');
        const orgId = new mongoose.Types.ObjectId(req.user.orgId);

        const topCustomer = await mongoose.model('Sale').aggregate([
            {
                $match: {
                    orgId,
                    isDeleted: false,
                    status: 'completed',
                    createdAt: { $gte: startOfMonth },
                    customerId: { $ne: null }
                }
            },
            {
                $group: {
                    _id: '$customerId',
                    totalSpent: { $sum: '$total' }
                }
            },
            { $sort: { totalSpent: -1 } },
            { $limit: 1 }
        ]);

        if (topCustomer.length > 0) {
            res.json({ customerId: topCustomer[0]._id });
        } else {
            res.json({ customerId: null });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    createCustomer,
    listCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    getTopCustomerThisMonth,
};
