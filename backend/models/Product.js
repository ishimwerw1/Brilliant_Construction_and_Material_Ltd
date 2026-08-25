const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    barcode: { type: String, trim: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    brand: { type: String, trim: true },
    description: { type: String, trim: true },
    unit: { type: String, required: true, default: 'piece', enum: ['piece', 'meter', 'box', 'bag', 'packet', 'roll', 'liter', 'kg', 'carton'] },
    buyingPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, default: 0, min: 0 },
    minStockLevel: { type: Number, default: 5, min: 0 },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    location: { type: String, trim: true },
    image: { type: String },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' }
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

productSchema.virtual('stockStatus', {
  ref: 'Product',
  localField: '_id',
  foreignField: '_id'
});

productSchema.methods.computeStockState = function () {
  if (this.status === 'INACTIVE') return this.stockStatus;
  if (this.quantity <= 0) return 'OUT_OF_STOCK';
  if (this.quantity <= this.minStockLevel) return 'LOW_STOCK';
  return 'NORMAL';
};

productSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.stockState = doc.computeStockState();
    return ret;
  }
});

module.exports = mongoose.model('Product', productSchema);
