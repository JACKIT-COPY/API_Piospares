const mongoose = require('mongoose');
const Joi = require('joi');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const { initiateSTKPush } = require('./mpesaController');
const { updateSaleStatusInternal } = require('./saleService');  // ← NEW

// ──────────────────────────────────────────────────────────────
// Joi Schemas
// ──────────────────────────────────────────────────────────────
const createSchema = Joi.object({
  products: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().required(),
        name: Joi.string().required(),
        price: Joi.number().positive().required(),  // Allow client-adjusted price
        quantity: Joi.number().integer().min(1).required(),
      })
    )
    .min(1)
    .required(),
  total: Joi.number().positive().optional(),  // Optional manual total
  discount: Joi.number().min(0).optional(),
  paymentMethod: Joi.string().valid('cash', 'mpesa', 'paybill', 'pending', 'split').required(),
  branchId: Joi.string().required(),
  customerId: Joi.string().allow(null, '').optional(),
  saleDate: Joi.date().iso().max('now').optional(),
  paymentSplits: Joi.when('paymentMethod', {
    is: 'split',
    then: Joi.array().items(
      Joi.object({
        method: Joi.string().valid('cash', 'mpesa', 'paybill', 'pending').required(),
        amount: Joi.number().positive().required(),
        completed: Joi.boolean().optional(),
        phoneNumber: Joi.when('method', {
          is: 'mpesa',
          then: Joi.string().pattern(/^254[17]\d{8}$/).required(),
          otherwise: Joi.forbidden(),
        }),
      })
    ).min(1).required(),
    otherwise: Joi.forbidden(),
  }),
  phoneNumber: Joi.when('paymentMethod', {
    is: 'mpesa',
    then: Joi.string().pattern(/^254[17]\d{8}$/).required(),
    otherwise: Joi.forbidden(),
  }),
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('completed', 'pending', 'returned').required(),
  paymentMethod: Joi.string()
    .valid('cash', 'mpesa', 'paybill', 'split')
    .when('status', { is: 'completed', then: Joi.required() }),
});


// ──────────────────────────────────────────────────────────────
// PUBLIC: createSale
// ──────────────────────────────────────────────────────────────
const createSale = async (req, res) => {
  const { error } = createSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { products, total: clientTotal, discount = 0, paymentMethod, branchId, customerId, phoneNumber, saleDate, paymentSplits } = req.body;
    const user = req.user;

    // ---- 1. Enrich & validate products (use client prices, check stock/branch) ----
    let computedTotal = 0;
    const enriched = [];

    for (const it of products) {
      const prod = await Product.findOne({
        _id: it.productId,
        orgId: user.orgId,
        branchId,
      }).session(session);

      if (!prod) throw new Error(`Product ${it.name} not found`);
      if (prod.stock < it.quantity) throw new Error(`Insufficient stock for ${it.name}`);

      // Use client price (adjusted) – no tampering check
      const itemPrice = it.price;
      computedTotal += itemPrice * it.quantity;

      enriched.push({
        productId: prod._id,
        name: prod.name,  // Use DB name for consistency
        price: itemPrice,
        quantity: it.quantity,
      });
    }

    if (discount > computedTotal) throw new Error('Discount cannot exceed total');

    // ---- 2. Use manual total if provided, else computed ----
    const finalTotal = clientTotal !== undefined ? clientTotal : (computedTotal - discount);

    // ---- validate splits if split payment ----
    if (paymentMethod === 'split') {
      if (!paymentSplits || !Array.isArray(paymentSplits) || paymentSplits.length === 0) throw new Error('paymentSplits required when paymentMethod is split');
      const splitSum = paymentSplits.reduce((s, p) => s + Number(p.amount), 0);
      if (Math.abs(splitSum - finalTotal) > 0.0001) throw new Error('Sum of paymentSplits amounts must equal total');
    }

    // ---- 3. Create sale ----
    // Handle optional backdated sale (`saleDate` in YYYY-MM-DD). If provided and not today, set createdAt/updatedAt
    // Determine pending/completed: if any split is mpesa or pending, we set pending
    let isPending = paymentMethod === 'pending' || paymentMethod === 'mpesa';
    if (paymentMethod === 'split') {
      const anyPendingOrMpesa = paymentSplits.some(p => p.method === 'mpesa' || p.method === 'pending');
      isPending = anyPendingOrMpesa;
    }

    const saleData = {
      orgId: user.orgId,
      branchId,
      userId: user.userId,
      customerId: customerId || null,
      products: enriched,
      total: finalTotal,
      discount,
      paymentMethod,
      paymentSplits: paymentMethod === 'split'
        ? paymentSplits.map(p => ({
          ...p,
          // cash and paybill are completed by default; mpesa and pending remain not completed
          completed: typeof p.completed === 'boolean' ? p.completed : (p.method === 'cash' || p.method === 'paybill')
        }))
        : [],
      status: isPending ? 'pending' : 'completed',
      phoneNumber: paymentMethod === 'mpesa' ? phoneNumber : null,
    };

    if (saleDate) {
      const saleDateObj = new Date(saleDate);
      const saleDateKey = saleDateObj.toISOString().split('T')[0];
      const todayKey = new Date().toISOString().split('T')[0];
      if (saleDateKey !== todayKey) {
        const overrideDate = new Date(saleDateKey);
        saleData.createdAt = overrideDate;
        saleData.updatedAt = overrideDate;
      }
    }

    const sale = new Sale(saleData);

    await sale.save({ session });

    // ---- 4. Deduct stock for immediate payments ----
    const shouldDeductStock = paymentMethod === 'cash' || paymentMethod === 'paybill' || (paymentMethod === 'split' && (!paymentSplits || !paymentSplits.some(p => p.method === 'mpesa' || p.method === 'pending')));
    if (shouldDeductStock) {
      for (const it of enriched) {
        await Product.findByIdAndUpdate(
          it.productId,
          { $inc: { stock: -it.quantity } },
          { session }
        );
      }
    }

    await session.commitTransaction();

    // ---- 5. M-PESA STK PUSH (single mpesa or mpesa splits) ----
    let stkResponse = null;
    const splitStkResponses = [];

    if (paymentMethod === 'mpesa') {
      try {
        stkResponse = await initiateSTKPush(phoneNumber, finalTotal, sale._id.toString());
        await Sale.findByIdAndUpdate(sale._id, { stkRequestID: stkResponse.CheckoutRequestID });
        console.log(`STK Push Success: ${stkResponse.CheckoutRequestID}`);
      } catch (stkErr) {
        console.error('STK Push Failed:', {
          error: stkErr.message,
          response: stkErr.response?.data,
          status: stkErr.response?.status
        });
        stkResponse = { error: 'STK push failed. Sale pending – retry or complete manually.' };
      }
    }

    if (paymentMethod === 'split') {
      try {
        // Initiate STK push for each mpesa split
        for (let i = 0; i < sale.paymentSplits.length; i++) {
          const sp = sale.paymentSplits[i];
          if (sp.method === 'mpesa') {
            try {
              const resp = await initiateSTKPush(sp.phoneNumber, sp.amount, sale._id.toString());
              // store the checkout id into the specific split
              await Sale.findByIdAndUpdate(sale._id, { $set: { [`paymentSplits.${i}.stkRequestID`]: resp.CheckoutRequestID } });
              splitStkResponses.push({ index: i, CheckoutRequestID: resp.CheckoutRequestID });
              console.log(`Split STK Push Success (split ${i}): ${resp.CheckoutRequestID}`);
            } catch (err) {
              console.error('Split STK Push Failed:', { index: i, error: err.message, response: err.response?.data, status: err.response?.status });
              splitStkResponses.push({ index: i, error: 'STK push failed' });
            }
          }
        }
      } catch (e) {
        console.error('Split STK processing error:', e);
      }
    }

    res.status(201).json({ sale, mpesa: stkResponse, splitMpesa: splitStkResponses });
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
    const { branchId, status, page = 1, limit = 500 } = req.query; //add limit to 500 paginated
    const query = {
      orgId: req.user.orgId,
      isDeleted: false  // ← ADD THIS TO EXCLUDE DELETED SALES
    };
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
    // ← ADD CHECK FOR isDeleted BEFORE CALLING INTERNAL
    const saleCheck = await Sale.findOne({
      _id: req.params.id,
      orgId: req.user.orgId,
      isDeleted: false  // ← ADD THIS
    });

    if (!saleCheck) throw new Error('Sale not found or deleted');

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

// ------------------------------------------------------------------
// SOFT DELETE (Owner / SuperManager only)
// ------------------------------------------------------------------
const softDeleteSale = async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sale = await Sale.findOne({
      _id: id,
      orgId: user.orgId,
      isDeleted: false,
    }).session(session);

    if (!sale) throw new Error('Sale not found or already deleted');

    // ---- RESTORE STOCK if sale was COMPLETED ----
    if (sale.status === 'completed') {
      for (const it of sale.products) {
        await Product.findByIdAndUpdate(
          it.productId,
          { $inc: { stock: it.quantity } },
          { session }
        );
      }
    }

    // ---- MARK AS DELETED ----
    await Sale.findByIdAndUpdate(
      id,
      {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: user._id,
      },
      { session }
    );

    await session.commitTransaction();
    res.json({ message: 'Sale soft-deleted successfully' });
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

// ------------------------------------------------------------------
// LIST RECENTLY DELETED (last 30 days, newest first)
// ------------------------------------------------------------------
const listRecentlyDeleted = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deleted = await Sale.find({
      orgId: req.user.orgId,
      isDeleted: true,
      deletedAt: { $gte: thirtyDaysAgo },
    })
      .select('total status paymentMethod createdAt deletedAt deletedBy')
      .populate('deletedBy', 'name')
      .sort({ deletedAt: -1 })
      .exec(); // optional, but good practice 

    res.json({ deleted });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createSale,
  listSales,
  updateSaleStatus,
  updateSaleStatusInternal, // ← used by callback
  softDeleteSale,
  listRecentlyDeleted,
};
