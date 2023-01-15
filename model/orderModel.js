const mongoose = require("mongoose");
const validator = require("validator");
const orderSchema = new mongoose.Schema(
  {
    AWB: {
      type: Number,
      required: [true, "AWB is mandatory for an order"],
    },
    names: {
      type: String,
      required: [true, "Customer Name is required for order"],
    },
    product: {
      type: String,
      required: [true, "Product SKU_ID must be provided for an order"],
    },
    estimatedTime: {
      type: Date,
      required: [true, "Estimated time must be provided for an order"],
    },
    address: {
      type: String,
      required: [true, "Address must be provided for an order"],
    },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
