const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Product = require('../models/Product');

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

module.exports = { updateSaleStatusInternal };