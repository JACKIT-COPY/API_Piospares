const axios = require('axios');
const Organization = require('../models/Organization');

const getUnifiedApiUrl = () => process.env.UNIFIED_API_URL || 'https://smsapi.solby.io:8443';

// Save messaging settings for the organization
const saveSettings = async (req, res) => {
    try {
        const { messagingApiKey } = req.body;
        const orgId = req.user.orgId;

        await Organization.findByIdAndUpdate(orgId, { messagingApiKey });
        res.json({ message: 'Settings saved successfully', messagingApiKey });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Proxies request to the unified API
const forwardToUnifiedApi = async (req, res) => {
    try {
        const orgId = req.user.orgId;
        const org = await Organization.findById(orgId);

        if (!org) {
            return res.status(404).json({ message: 'Organization not found' });
        }

        const apiKey = org.messagingApiKey || process.env.UNIFIED_API_KEY;

        if (!apiKey) {
            return res.status(400).json({ message: 'Messaging API Key not configured for this organization.' });
        }

        // e.g. /messaging/notifications/send -> /notifications/send
        // The router naturally strips the base path if we mount it, but wait:
        // if router is app.use('/messaging', router);
        // then req.url inside the router will be /notifications/send.
        const unifiedPath = req.url; // Includes query parameters
        const urlStr = `${getUnifiedApiUrl()}${unifiedPath}`;

        const urlObj = new URL(urlStr);
        urlObj.searchParams.set('apikey', apiKey);

        const options = {
            method: req.method,
            url: urlObj.toString(),
            headers: {
                "Content-Type": "application/json",
                "UNIFIED-API-Key": apiKey
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        };

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            options.data = req.body;
        }

        const response = await axios(options);
        res.status(response.status).json(response.data);
    } catch (err) {
        if (err.response) {
            res.status(err.response.status).json(err.response.data);
        } else {
            res.status(500).json({ message: err.message });
        }
    }
};

module.exports = {
    saveSettings,
    forwardToUnifiedApi
};
