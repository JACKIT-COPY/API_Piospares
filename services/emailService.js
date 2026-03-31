const axios = require('axios');
const Organization = require('../models/Organization');

const getUnifiedApiUrl = () => process.env.UNIFIED_API_URL || 'https://smsapi.solby.io:8443';

/**
 * Send email via Uniflow API
 * @param {string} orgId - Organization ID
 * @param {string} toEmail - Recipient email
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML email content
 * @param {object} options - Additional options
 * @returns {Promise<object>} Response from API with notification ID
 */
const sendEmail = async (orgId, toEmail, subject, htmlContent, options = {}) => {
  try {
    const org = await Organization.findById(orgId);
    
    if (!org) {
      throw new Error('Organization not found');
    }

    const apiKey = org.messagingApiKey || process.env.UNIFIED_API_KEY || 'nk_bf50200c662c8a8334cbffa07d1c63a232156fd9249f3689c1d6f2e39d2d51a5';
    
    if (!apiKey) {
      console.warn(`[Email Service] No API key found for org ${org.name}. Set messagingApiKey in organization or UNIFIED_API_KEY env var`);
      throw new Error('Messaging API Key not configured for this organization');
    }

    // Prepare email payload for Uniflow
    const emailPayload = {
      recipient: toEmail,
      subject: subject,
      content: htmlContent,
      contentType: 'text/html',
      senderName: org.name || 'Piospares Suite'
    };

    // Merge with any additional options
    Object.assign(emailPayload, options);

    const baseUrl = getUnifiedApiUrl();
    const urlStr = `${baseUrl}/notifications/email/send`;
    const urlObj = new URL(urlStr);
    urlObj.searchParams.set('apikey', apiKey);

    console.log(`[Email Service] Sending email to ${toEmail} via ${baseUrl}`);

    const config = {
      method: 'POST',
      url: urlObj.toString(),
      headers: {
        'Content-Type': 'application/json',
        'UNIFIED-API-Key': apiKey
      },
      data: emailPayload,
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    };

    const response = await axios(config);
    
    return {
      success: true,
      notificationId: response.data?.notificationId || response.data?.id,
      response: response.data
    };
  } catch (error) {
    console.error(`[Email Service] Error sending email to ${toEmail}:`, error.response?.status || error.message);
    console.error(`[Email Service] Full error:`, error.response?.data || error.message);
    throw {
      success: false,
      message: error.response?.data?.message || error.message,
      statusCode: error.response?.status,
      error: error.response?.data || error
    };
  }
};

/**
 * Generate HTML email template for report
 */
const generateReportEmailTemplate = (reportData, orgName, reportTypes) => {
  const typeLabels = {
    sales: 'Sales Report',
    expenses: 'Expenses Report',
    inventory: 'Inventory Report',
    procurement: 'Procurement Report'
  };

  let reportSections = '';
  
  if (reportData.sales && reportTypes.includes('sales')) {
    reportSections += `
      <div style="margin: 20px 0; border-bottom: 1px solid #ddd; padding-bottom: 20px;">
        <h3 style="color: #2c3e50; margin-top: 0;">📊 Sales Report</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background: #ecf0f1;">
            <td style="padding: 8px; border: 1px solid #bdc3c7;"><strong>Total Revenue</strong></td>
            <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: right;">KSh ${reportData.sales.totalRevenue?.toLocaleString() || 0}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #bdc3c7;"><strong>Total Transactions</strong></td>
            <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: right;">${reportData.sales.totalTransactions || 0}</td>
          </tr>
          <tr style="background: #ecf0f1;">
            <td style="padding: 8px; border: 1px solid #bdc3c7;"><strong>Average Transaction</strong></td>
            <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: right;">KSh ${reportData.sales.avgTicket?.toLocaleString() || 0}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #bdc3c7;"><strong>Items Sold</strong></td>
            <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: right;">${reportData.sales.itemsSold || 0}</td>
          </tr>
        </table>
      </div>
    `;
  }

  if (reportData.expenses && reportTypes.includes('expenses')) {
    reportSections += `
      <div style="margin: 20px 0; border-bottom: 1px solid #ddd; padding-bottom: 20px;">
        <h3 style="color: #2c3e50; margin-top: 0;">💰 Expenses Report</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background: #ecf0f1;">
            <td style="padding: 8px; border: 1px solid #bdc3c7;"><strong>Total Expenses</strong></td>
            <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: right;">KSh ${reportData.expenses.totalExpenses?.toLocaleString() || 0}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #bdc3c7;"><strong>Expense Count</strong></td>
            <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: right;">${reportData.expenses.count || 0}</td>
          </tr>
          <tr style="background: #ecf0f1;">
            <td style="padding: 8px; border: 1px solid #bdc3c7;"><strong>Average Expense</strong></td>
            <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: right;">KSh ${reportData.expenses.avgExpense?.toLocaleString() || 0}</td>
          </tr>
        </table>
      </div>
    `;
  }

  if (reportData.inventory && reportTypes.includes('inventory')) {
    reportSections += `
      <div style="margin: 20px 0; border-bottom: 1px solid #ddd; padding-bottom: 20px;">
        <h3 style="color: #2c3e50; margin-top: 0;">📦 Inventory Report</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background: #ecf0f1;">
            <td style="padding: 8px; border: 1px solid #bdc3c7;"><strong>Total Stock Value</strong></td>
            <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: right;">KSh ${reportData.inventory.totalValue?.toLocaleString() || 0}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #bdc3c7;"><strong>Total Items</strong></td>
            <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: right;">${reportData.inventory.totalItems || 0}</td>
          </tr>
          <tr style="background: #ecf0f1;">
            <td style="padding: 8px; border: 1px solid #bdc3c7;"><strong>Low Stock Items</strong></td>
            <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: right; color: #e74c3c;"><strong>${reportData.inventory.lowStockCount || 0}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #bdc3c7;"><strong>Out of Stock</strong></td>
            <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: right; color: #c0392b;"><strong>${reportData.inventory.outOfStockCount || 0}</strong></td>
          </tr>
        </table>
      </div>
    `;
  }

  if (reportData.procurement && reportTypes.includes('procurement')) {
    reportSections += `
      <div style="margin: 20px 0; border-bottom: 1px solid #ddd; padding-bottom: 20px;">
        <h3 style="color: #2c3e50; margin-top: 0;">🛒 Procurement Report</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background: #ecf0f1;">
            <td style="padding: 8px; border: 1px solid #bdc3c7;"><strong>Total Purchase Orders</strong></td>
            <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: right;">${reportData.procurement.totalOrders || 0}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #bdc3c7;"><strong>Total Amount</strong></td>
            <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: right;">KSh ${reportData.procurement.totalAmount?.toLocaleString() || 0}</td>
          </tr>
          <tr style="background: #ecf0f1;">
            <td style="padding: 8px; border: 1px solid #bdc3c7;"><strong>Pending Orders</strong></td>
            <td style="padding: 8px; border: 1px solid #bdc3c7; text-align: right;">${reportData.procurement.pendingCount || 0}</td>
          </tr>
        </table>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
    <head>
        <meta charset="UTF-8">
        <meta content="width=device-width, initial-scale=1" name="viewport">
        <title>Automated Report - ${reportTypes.map(t => typeLabels[t]).join(', ')}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5;">
        <div style="background-color: #f5f5f5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #1f3a8a 0%, #6b21a8 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; color: white; font-size: 24px;">📈 Automated Report</h1>
                    <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 14px;">${orgName}</p>
                </div>

                <!-- Content -->
                <div style="padding: 30px 20px;">
                    <p style="color: #555; margin: 0 0 20px 0;">
                        Hello,<br><br>
                        Please find your automated report below for <strong>${new Date().toLocaleDateString()}</strong>.
                    </p>

                    ${reportSections}

                    <div style="background-color: #f0f9ff; padding: 15px; border-radius: 4px; border-left: 4px solid #3b82f6; margin-top: 20px;">
                        <p style="margin: 0; color: #1e40af; font-size: 13px;">
                            <strong>Note:</strong> This is an automated report generated by your Piospares Suite settings. 
                            To modify your report preferences, log in to your dashboard.
                        </p>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                    <p style="margin: 0; color: #6b7280; font-size: 12px;">
                        © ${new Date().getFullYear()} Piospares Suite. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
};

module.exports = {
  sendEmail,
  generateReportEmailTemplate
};
