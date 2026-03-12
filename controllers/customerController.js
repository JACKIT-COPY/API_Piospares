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
        const { search, page = 1, limit = 10, sort = 'name', branchId } = req.query;
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

        // Build the sales lookup match condition — optionally filter by branchId
        const salesMatchExpr = [
            { $eq: ['$customerId', '$$customerId'] },
            { $ne: ['$isDeleted', true] }
        ];
        if (branchId) {
            salesMatchExpr.push({ $eq: ['$branchId', new mongoose.Types.ObjectId(branchId)] });
        }

        const pipeline = [
            { $match: query },
            {
                $lookup: {
                    from: 'sales',
                    let: { customerId: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $and: salesMatchExpr } } }
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
            // When filtering by branch, exclude customers with zero sales at that branch
            ...(branchId ? [{ $match: { salesVolume: { $gt: 0 } } }] : []),
            { $project: { customerSales: 0 } },
            { $sort: sortObj },
            { $skip: skip },
            { $limit: limitNum }
        ];

        const customers = await Customer.aggregate(pipeline);

        // For count, we need a separate pipeline when branchId is provided
        let count;
        if (branchId) {
            const countPipeline = [
                { $match: query },
                {
                    $lookup: {
                        from: 'sales',
                        let: { customerId: '$_id' },
                        pipeline: [
                            { $match: { $expr: { $and: salesMatchExpr } } }
                        ],
                        as: 'customerSales'
                    }
                },
                { $addFields: { salesVolume: { $size: '$customerSales' } } },
                { $match: { salesVolume: { $gt: 0 } } },
                { $count: 'total' }
            ];
            const countResult = await Customer.aggregate(countPipeline);
            count = countResult.length > 0 ? countResult[0].total : 0;
        } else {
            count = await Customer.countDocuments(query);
        }

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
        const { branchId } = req.query;
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const mongoose = require('mongoose');
        const orgId = new mongoose.Types.ObjectId(req.user.orgId);

        const matchStage = {
            orgId,
            isDeleted: false,
            status: 'completed',
            createdAt: { $gte: startOfMonth },
            customerId: { $ne: null }
        };
        if (branchId) {
            matchStage.branchId = new mongoose.Types.ObjectId(branchId);
        }

        const topCustomer = await mongoose.model('Sale').aggregate([
            { $match: matchStage },
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
