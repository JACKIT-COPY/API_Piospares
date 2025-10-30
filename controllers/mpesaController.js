const axios = require('axios');
require('dotenv').config();
const { updateSaleStatusInternal } = require('./salesController'); // <-- NEW

const {
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORT_CODE,
  MPESA_PASS_KEY,
  MPESA_CALLBACK_URL,
  MPESA_IS_SANDBOX = 'true',
} = process.env;

const BASE_URL = MPESA_IS_SANDBOX === 'true'
  ? 'https://sandbox.safaricom.co.ke/mpesa'
  : 'https://api.safaricom.co.ke/mpesa';

// ──────────────────────────────────────────────────────────────
// Helper utils
// ──────────────────────────────────────────────────────────────
const getTimestamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const getPassword = ts => Buffer.from(`${MPESA_SHORT_CODE}${MPESA_PASS_KEY}${ts}`).toString('base64');

const getAccessToken = async () => {
  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  const { data } = await axios.get(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  return data.access_token;
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
    AccountReference: saleId,          // <-- SALE ID
    TransactionDesc: desc,
  };

  const { data } = await axios.post(`${BASE_URL}/stkpush/v1/processrequest`, payload, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return data; // { CheckoutRequestID, ResponseCode, CustomerMessage, ... }
};

// ──────────────────────────────────────────────────────────────
// PUBLIC: callback from Safaricom
// ──────────────────────────────────────────────────────────────
const handleCallback = async (req, res) => {
  try {
    const { Body } = req.body;
    if (!Body?.stkCallback) return res.json({ ResultCode: 1, ResultDesc: 'Bad payload' });

    const cb = Body.stkCallback;
    console.log('M-Pesa Callback →', JSON.stringify(cb, null, 2));

    // ---- ACKNOWLEDGE IMMEDIATELY ----
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

    // ---- PROCESS ASYNC ----
    if (cb.ResultCode !== 0) {
      console.warn('M-Pesa payment failed →', cb.ResultDesc);
      return;
    }

    const items = cb.CallbackMetadata?.Item || [];
    const amount = items.find(i => i.Name === 'Amount')?.Value ?? 0;
    const receipt = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value ?? null;
    const phone = items.find(i => i.Name === 'PhoneNumber')?.Value ?? null;
    const saleId = cb.MerchantRequestID; // we set AccountReference = saleId → comes back as MerchantRequestID

    const Sale = require('../models/Sale');
    const sale = await Sale.findOne({ _id: saleId, status: 'pending', paymentMethod: 'mpesa' });

    if (!sale) {
      console.error('Sale not found for callback →', saleId);
      return;
    }
    if (Number(amount) !== Number(sale.total)) {
      console.error('Amount mismatch →', { expected: sale.total, received: amount });
      return;
    }

    // ---- UPDATE SALE (reuse internal function) ----
    await updateSaleStatusInternal(saleId, 'completed', 'mpesa', receipt);
    console.log(`Sale ${saleId} completed – receipt ${receipt}`);
  } catch (err) {
    console.error('Callback processing error →', err);
  }
};

module.exports = { initiateSTKPush, handleCallback };