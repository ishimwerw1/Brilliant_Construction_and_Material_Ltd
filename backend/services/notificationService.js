const Notification = require('../models/Notification');

const notify = async ({ type, title, message, link, meta, session }) => {
  try {
    await Notification.create([{ type, title, message, link, meta }], { session });
  } catch (err) {
    console.error('Notification failed:', err.message);
  }
};

const checkLowStock = async (product, session) => {
  if (product.status !== 'ACTIVE') return;
  if (product.quantity <= 0) {
    await notify({
      type: 'OUT_OF_STOCK',
      title: 'Out of Stock',
      message: `"${product.name}" (${product.sku}) is out of stock.`,
      link: `/products/${product._id}`,
      meta: { productId: product._id },
      session
    });
  } else if (product.quantity <= product.minStockLevel) {
    await notify({
      type: 'LOW_STOCK',
      title: 'Low Stock Alert',
      message: `"${product.name}" (${product.sku}) is low: ${product.quantity} ${product.unit}(s) left (min ${product.minStockLevel}).`,
      link: `/products/${product._id}`,
      meta: { productId: product._id },
      session
    });
  }
};

module.exports = { notify, checkLowStock };
