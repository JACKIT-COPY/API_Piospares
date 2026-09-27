const express = require('express');
const { getCreditorsSummary } = require('../controllers/financeController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/summary', authMiddleware, roleMiddleware(['Owner', 'Manager', 'SuperManager']), getCreditorsSummary);

module.exports = router;
