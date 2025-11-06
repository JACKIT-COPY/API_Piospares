const mongoose = require('mongoose');
const Joi = require('joi');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const { initiateSTKPush } = require('./mpesaController');

// ──────────────────────────────────────────────────────────────
// Joi Schemas
// ──────────────────────────────────────────────────────────────
const createSchema = Joi.object({
  products: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().required(),
        name: Joi.string().required(),
        price: Joi.number().positive().required(),
        quantity: Joi.number().integer().min(1).required(),
      })
    )
    .min(1)
    .required(),
  discount: Joi.number().min(0).optional(),
  paymentMethod: Joi.string().valid('cash', 'mpesa', 'paybill', 'pending').required(),
  branchId: Joi.string().required(),
  phoneNumber: Joi.when('paymentMethod', {
    is: 'mpesa',
    then: Joi.string().pattern(/^254[17]\d{8}$/).required(),
    otherwise: Joi.forbidden(),
  }),
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('completed', 'pending', 'returned').required(),
  paymentMethod: Joi.string()
    .valid('cash', 'mpesa')
    .when('status', { is: 'completed', then: Joi.required() }),
});

// ──────────────────────────────────────────────────────────────
// INTERNAL: reusable stock + status change (used by callback)
// ──────────────────────────────────────────────────────────────
const updateSaleStatusInternal = async (saleId, newStatus, paymentMethod = null, receipt = null) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const sale = await Sale.findById(saleId).session(session);
    if (!sale) throw new Error('Sale not found');

    // ---- STOCK DEDUCTION (pending → completed) ----
    if (newStatus === 'completed' && sale.status === 'pending') {
      for (const item of sale.products) {
        const prod = await Product.findOneAndUpdate(
          { _id: item.productId, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { new: true, session }
        );
        if (!prod) throw new Error(`Insufficient stock for ${item.name}`);
      }
    }

    // ---- RESTOCK (any → returned) ----
    if (newStatus === 'returned' && sale.status !== 'returned') {
      for (const item of sale.products) {
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: item.quantity } },
          { session }
        );
      }
    }

    // ---- UPDATE SALE ----
    sale.status = newStatus;
    if (paymentMethod) sale.paymentMethod = paymentMethod;
    if (receipt) sale.receiptNumber = receipt;

    await sale.save({ session });
    await session.commitTransaction();
    return sale;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// ──────────────────────────────────────────────────────────────
// PUBLIC: createSale
// ──────────────────────────────────────────────────────────────
const createSale = async (req, res) => {
  const { error } = createSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { products, discount = 0, paymentMethod, branchId, phoneNumber } = req.body;
    const user = req.user;

    // ---- 1. Enrich & validate products (price from DB) ----
    let total = 0;
    const enriched = [];

    for (const it of products) {
      const prod = await Product.findOne({
        _id: it.productId,
        orgId: user.orgId,
        branchId,
      }).session(session);

      if (!prod) throw new Error(`Product ${it.name} not found`);
      if (prod.price !== it.price) {
        return res.status(400).json({ message: `Price mismatch for ${it.name}` });
      }
      if (prod.stock < it.quantity) throw new Error(`Insufficient stock for ${it.name}`);

      total += prod.price * it.quantity;
      enriched.push({
        productId: prod._id,
        name: prod.name,
        price: prod.price,
        quantity: it.quantity,
      });
    }

    if (discount > total) throw new Error('Discount cannot exceed total');
    const finalTotal = total - discount;

    // ---- 2. Create sale ----
    const isPendingPayment = paymentMethod === 'pending' || paymentMethod === 'mpesa';
    const sale = new Sale({
      orgId: user.orgId,
      branchId,
      userId: user.userId,
      products: enriched,
      total: finalTotal,
      discount,
      paymentMethod,
      status: isPendingPayment ? 'pending' : 'completed',  // ← 'paybill' treated as immediate (completed)
      phoneNumber: paymentMethod === 'mpesa' ? phoneNumber : null,
    });

    await sale.save({ session });

    // ---- 3. Deduct stock for cash/paybill ----
    if (paymentMethod === 'cash' || paymentMethod === 'paybill') {
      for (const it of enriched) {
        await Product.findByIdAndUpdate(
          it.productId,
          { $inc: { stock: -it.quantity } },
          { session }
        );
      }
    }

    await session.commitTransaction();

    // ---- 4. M-PESA STK PUSH (only for mpesa) ----
    let stkResponse = null;
    if (paymentMethod === 'mpesa') {
      try {
        stkResponse = await initiateSTKPush(phoneNumber, finalTotal, sale._id.toString());
        await Sale.findByIdAndUpdate(sale._id, { stkRequestID: stkResponse.CheckoutRequestID });
        console.log(`STK Push Success: ${stkResponse.CheckoutRequestID}`);
      } catch (stkErr) {
        console.error('STK Push Failed:', {
          error: stkErr.message,
          response: stkErr.response?.data,
          status: stkErr.response?.status,
        });
        stkResponse = { error: 'STK push failed. Sale pending – retry or complete manually.' };
      }
    }

    res.status(201).json({ sale, mpesa: stkResponse });
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
};



// ──────────────────────────────────────────────────────────────
// PUBLIC: listSales (with pagination)
// ──────────────────────────────────────────────────────────────
const listSales = async (req, res) => {
  try {
    const { branchId, status, page = 1, limit = 20 } = req.query;
    const query = { orgId: req.user.orgId };
    if (branchId) query.branchId = branchId;
    if (status) query.status = status;

    const sales = await Sale.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const total = await Sale.countDocuments(query);
    res.json({ sales, pagination: { page: Number(page), limit: Number(limit), total } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ──────────────────────────────────────────────────────────────
// PUBLIC: updateSaleStatus (manual)
// ──────────────────────────────────────────────────────────────
const updateSaleStatus = async (req, res) => {
  const { error } = updateStatusSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const sale = await updateSaleStatusInternal(
      req.params.id,
      req.body.status,
      req.body.paymentMethod || null
    );
    res.json(sale);
  } catch (err) {
    res.status(err.message.includes('not found') ? 404 : 400).json({ message: err.message });
  }
};

module.exports = {
  createSale,
  listSales,
  updateSaleStatus,
  updateSaleStatusInternal, // ← used by callback
};