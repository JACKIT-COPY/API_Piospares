const axios = require('axios');
require('dotenv').config();

const {
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORT_CODE,
  MPESA_PASS_KEY,
  MPESA_CALLBACK_URL,
  MPESA_IS_SANDBOX,
} = process.env;

const BASE_URL = MPESA_IS_SANDBOX
  ? 'https://sandbox.safaricom.co.ke/mpesa'
  : 'https://api.safaricom.co.ke/mpesa';

// Generate timestamp: YYYYMMDDHHmmss
const getTimestamp = () => {
  const now = new Date();
  return now.toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14);
};

// Generate Base64 password: base64(shortcode + passkey + timestamp)
const getPassword = (timestamp) => {
  const str = `${MPESA_SHORT_CODE}${MPESA_PASS_KEY}${timestamp}`;
  return Buffer.from(str).toString('base64');
};

// Get OAuth access token
const getAccessToken = async () => {
  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  const response = await axios.get(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  return response.data.access_token;
};

// Initiate STK Push
const initiateSTKPush = async (phoneNumber, amount, accountReference, transactionDesc = 'POS Sale') => {
  const timestamp = getTimestamp();
  const password = getPassword(timestamp);
  const accessToken = await getAccessToken();

  const url = `${BASE_URL}/stkpush/v1/processrequest`;
  const data = {
    BusinessShortCode: MPESA_SHORT_CODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: phoneNumber,
    PartyB: MPESA_SHORT_CODE,
    PhoneNumber: phoneNumber,
    CallBackURL: MPESA_CALLBACK_URL,
    AccountReference: accountReference,  // Links to sale._id
    TransactionDesc: transactionDesc,
  };

  const response = await axios.post(url, data, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  return response.data;  // { CheckoutRequestID, ... }
};

// Handle M-Pesa Callback (public endpoint)
const handleCallback = async (req, res) => {
  try {
    const { Body } = req.body;
    if (!Body || !Body.stkCallback) {
      return res.status(400).json({ ResultCode: 1, ResultDesc: 'Invalid callback' });
    }

    const callback = Body.stkCallback;
    console.log('M-Pesa Callback:', JSON.stringify(callback, null, 2));

    // Acknowledge to Safaricom (MUST respond immediately)
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

    // Process asynchronously
    if (callback.ResultCode === 0) {
      // Success: Extract metadata
      const metadata = callback.CallbackMetadata || [];
      const amountItem = metadata.find(item => item.Name === 'Amount');
      const receiptItem = metadata.find(item => item.Name === 'MpesaReceiptNumber');
      const phoneItem = metadata.find(item => item.Name === 'PhoneNumber');

      const amount = amountItem ? parseInt(amountItem.Value) : 0;
      const receipt = receiptItem ? receiptItem.Value : null;
      const phone = phoneItem ? phoneItem.Value : null;

      const accountReference = callback.CheckoutRequestID;  // Or from AccountReference if stored

      // Find and update sale
      const Sale = require('../models/Sale');
      const sale = await Sale.findOne({ _id: accountReference, status: 'pending', paymentMethod: 'mpesa' });

      if (sale && amount === sale.total) {  // Verify amount matches
        // Update to completed
        await updateSaleStatus(sale._id, 'completed', 'mpesa');  // Reuse your existing function
        console.log(`Sale ${sale._id} completed via M-Pesa: Receipt ${receipt}`);
      } else {
        console.error('Sale not found or amount mismatch:', accountReference, amount);
      }
    } else {
      // Failure
      console.error('M-Pesa Payment Failed:', callback.ResultDesc);
      // Optional: Update sale to 'failed' or notify
    }
  } catch (err) {
    console.error('Callback Error:', err);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Processing Error' });
  }
};

// Optional: Query Transaction Status (for polling if callback misses)
const queryTransaction = async (checkoutRequestID) => {
  const timestamp = getTimestamp();
  const password = getPassword(timestamp);
  const accessToken = await getAccessToken();

  const url = `${BASE_URL}/stkpushquery/v1/query`;
  const data = {
    BusinessShortCode: MPESA_SHORT_CODE,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestID,
  };

  const response = await axios.post(url, data, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  return response.data;
};

module.exports = { initiateSTKPush, handleCallback, queryTransaction };