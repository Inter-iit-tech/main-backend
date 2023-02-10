const mongoose = require("mongoose");
const productSchema = new mongoose.Schema(
  {
    skuID: {
      type: String,
      required: [true, "SKU_ID of the product is mandatory"],
      unique: true,
    },
    name: {
      type: String,
    },
    deadWeight: {
      type: Number,
    },
    volume: {
      type: Number,
    },
    length: {
      type: Number,
    },
    breadth: {
      type: Number,
    },
    height: {
      type: Number,
    },
    orders: [
      {
        AWB: String,
        isErroneous: Boolean,
        volume: Number,
        deadWeight: Number,
      },
    ],
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

productSchema.index({ skuID: "text" });

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
