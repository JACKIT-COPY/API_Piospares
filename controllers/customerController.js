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
        const { search, page = 1, limit = 10 } = req.query;
        const query = { orgId: req.user.orgId, isDeleted: false };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        const customers = await Customer.find(query)
            .sort({ name: 1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const count = await Customer.countDocuments(query);

        res.json({
            customers,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
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

module.exports = {
    createCustomer,
    listCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
};
