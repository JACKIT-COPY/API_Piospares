const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const {
  listTransfers,
  getTransfer,
  createTransfer,
  approveTransfer,
  rejectTransfer,
  completeTransfer,
  cancelTransfer
} = require('../controllers/stockTransferController');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     StockTransferRequest:
 *       type: object
 *       properties:
 *         sourceBranchId:
 *           type: string
 *         destinationBranchId:
 *           type: string
 *         products:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               productId:
 *                 type: string
 *               quantityRequested:
 *                 type: number
 *         reason:
 *           type: string
 */

// List transfers
router.get('/', authMiddleware, listTransfers);

// Get transfer detail
router.get('/:id', authMiddleware, getTransfer);

// Create transfer request (all authenticated users)
router.post(
  '/',
  authMiddleware,
  createTransfer
);

// Approve transfer (managers+)
router.put(
  '/:id/approve',
  authMiddleware,
  roleMiddleware(['Owner', 'SuperManager', 'Manager']),
  approveTransfer
);

// Reject transfer (managers+)
router.put(
  '/:id/reject',
  authMiddleware,
  roleMiddleware(['Owner', 'SuperManager', 'Manager']),
  rejectTransfer
);

// Complete transfer (managers+)
router.put(
  '/:id/complete',
  authMiddleware,
  roleMiddleware(['Owner', 'SuperManager', 'Manager']),
  completeTransfer
);

// Cancel transfer (requester or managers+)
router.put(
  '/:id/cancel',
  authMiddleware,
  cancelTransfer
);

module.exports = router;
