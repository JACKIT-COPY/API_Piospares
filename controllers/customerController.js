const Customer = require('../models/Customer');

// @desc    List customers
const listCustomers = async (req, res) => {
  try {
    const { search, page = 1, sort = 'name', branchId, limit = 50 } = req.query;
    const query = { orgId: req.user.orgId };
    
    if (branchId) query.branchId = branchId;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    let sortOptions = { name: 1 };
    if (sort === 'top_spenders') sortOptions = { totalSpent: -1 };
    if (sort === 'volume') sortOptions = { salesVolume: -1 };

    const parsedLimit = parseInt(limit, 10);
    const parsedPage = parseInt(page, 10);
    const skip = (parsedPage - 1) * parsedLimit;

    const customers = await Customer.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const total = await Customer.countDocuments(query);

    res.json({
      customers,
      totalPages: Math.ceil(total / parsedLimit),
      currentPage: parsedPage,
      totalCustomers: total,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get single customer
const getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, orgId: req.user.orgId });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Create customer
const createCustomer = async (req, res) => {
  try {
    const { name, email, phone, address, branchId } = req.body;
    const customer = new Customer({
      orgId: req.user.orgId,
      branchId,
      name,
      email,
      phone,
      address,
    });
    await customer.save();
    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update customer
const updateCustomer = async (req, res) => {
  try {
    const { name, email, phone, address, branchId } = req.body;
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, orgId: req.user.orgId },
      { name, email, phone, address, branchId },
      { new: true, runValidators: true }
    );
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Delete customer
const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOneAndDelete({ _id: req.params.id, orgId: req.user.orgId });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { listCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer };
