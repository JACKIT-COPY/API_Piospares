const axios = require('axios');
require('dotenv').config();
const { updateSaleStatusInternal } = require('./saleService');  // ← CHANGE
const {
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORT_CODE,
  MPESA_PASS_KEY,
  MPESA_CALLBACK_URL,
  MPESA_IS_SANDBOX = 'true',
} = process.env;

// FIX: Base URL without /mpesa
const IS_SANDBOX = String(MPESA_IS_SANDBOX).toLowerCase() === 'true';
const BASE_URL = IS_SANDBOX
  ? 'https://sandbox.safaricom.co.ke'
  : 'https://api.safaricom.co.ke';

// ──────────────────────────────────────────────────────────────
// Helper utils
// ──────────────────────────────────────────────────────────────
const getTimestamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const getPassword = ts => Buffer.from(`${MPESA_SHORT_CODE}${MPESA_PASS_KEY}${ts}`).toString('base64');

const getAccessToken = async () => {
  try {
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
    const { data } = await axios.get(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    return data.access_token;
  } catch (err) {
    console.error('M-Pesa Access Token Error:', {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });
    throw err; // Bubble up
  }
};

// ──────────────────────────────────────────────────────────────
// PUBLIC: initiate STK push
// ──────────────────────────────────────────────────────────────
const initiateSTKPush = async (phoneNumber, amount, saleId, desc = 'POS Sale') => {
  const timestamp = getTimestamp();
  const password = getPassword(timestamp);
  const token = await getAccessToken();

  const payload = {
    BusinessShortCode: MPESA_SHORT_CODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: phoneNumber,
    PartyB: MPESA_SHORT_CODE,
    PhoneNumber: phoneNumber,
    CallBackURL: MPESA_CALLBACK_URL,
    AccountReference: saleId,
    TransactionDesc: desc,
  };

  try {
    const { data } = await axios.post(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, payload, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    return data;
  } catch (err) {
    console.error('M-Pesa STK Push Error:', {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      payload: payload, // For debug
    });
    throw err;
  }
};

// ──────────────────────────────────────────────────────────────
// PUBLIC: callback from Safaricom
// ──────────────────────────────────────────────────────────────
const handleCallback = async (req, res) => {
  try {
    const { Body } = req.body;
    if (!Body?.stkCallback) return res.json({ ResultCode: 1, ResultDesc: 'Bad payload' });

    const cb = Body.stkCallback;
    console.log('M-Pesa Callback:', JSON.stringify(cb, null, 2));

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

    if (cb.ResultCode !== 0) {
      console.warn('M-Pesa payment failed:', cb.ResultDesc);
      return;
    }

    const items = cb.CallbackMetadata?.Item || [];
    const amount = items.find(i => i.Name === 'Amount')?.Value ?? 0;
    const receipt = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value ?? null;
    const phone = items.find(i => i.Name === 'PhoneNumber')?.Value ?? null;
    const checkoutId = cb.CheckoutRequestID;

    const Sale = require('../models/Sale');
    // First try matching top-level mpesa flow, or any split that has this stkRequestID
    const sale = await Sale.findOne({
      status: 'pending',
      $or: [
        { stkRequestID: checkoutId, paymentMethod: 'mpesa' },
        { paymentSplits: { $elemMatch: { stkRequestID: checkoutId } } }
      ]
    });

    if (!sale) {
      console.error('Sale not found for callback:', { checkoutId, amount });
      return;
    }

    // SINGLE MPESA (legacy)
    if (sale.paymentMethod === 'mpesa' && sale.stkRequestID === checkoutId) {
      if (Number(amount) !== Number(sale.total)) {
        console.error('Amount mismatch:', { expected: sale.total, received: amount });
        return;
      }

      await updateSaleStatusInternal(sale._id, 'completed', 'mpesa', receipt);
      console.log(`Sale ${sale._id} completed via M-Pesa – receipt ${receipt}`);
      return;
    }

    // SPLIT PAYMENT: find the matching split and mark it completed
    if (sale.paymentMethod === 'split') {
      const splitIdx = sale.paymentSplits.findIndex(s => s.stkRequestID === checkoutId);
      if (splitIdx === -1) {
        console.error('No matching split found for stkRequestID:', checkoutId);
        return;
      }

      const split = sale.paymentSplits[splitIdx];
      if (Number(amount) !== Number(split.amount)) {
        console.error('Split amount mismatch:', { expected: split.amount, received: amount, saleId: sale._id });
        return;
      }

      // mark split as completed and set receipt
      await Sale.findByIdAndUpdate(sale._id, { $set: { [`paymentSplits.${splitIdx}.completed`]: true, [`paymentSplits.${splitIdx}.receiptNumber`]: receipt } });
      console.log(`Sale ${sale._id} split ${splitIdx} completed via M-Pesa – receipt ${receipt}`);

      // re-fetch to check if all splits are completed
      const freshSale = await Sale.findById(sale._id);
      const allCompleted = freshSale.paymentSplits.every(s => s.completed || s.method === 'cash' || s.method === 'paybill');
      const completedSum = freshSale.paymentSplits.reduce((s, p) => s + ((p.completed || p.method === 'cash' || p.method === 'paybill') ? Number(p.amount) : 0), 0);

      if (allCompleted && Math.abs(completedSum - Number(freshSale.total)) < 0.0001) {
        // mark sale completed
        await updateSaleStatusInternal(freshSale._id, 'completed', 'split', receipt);
        console.log(`Sale ${freshSale._id} completed via split payments.`);
      }

      return;
    }

    console.error('Unhandled mpesa callback case for sale', { saleId: sale._id, paymentMethod: sale.paymentMethod });
  } catch (err) {
    console.error('Callback processing error:', err);
  }
};

module.exports = { initiateSTKPush, handleCallback };