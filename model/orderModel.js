const mongoose = require("mongoose");
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
    productID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID must be provided for an order"],
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
    isDelivered: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ["delivery", "pickup"],
      default: "delivery",
    },
    isFakeAttempt: {
      type: Boolean,
      default: false,
    },
    addTime: { type: String },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
