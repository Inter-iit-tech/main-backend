const mongoose = require("mongoose");
const riderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
    },
    phoneNumber: {
      type: String,
    },
    firebaseMessagingId: {
      type: String,
    },
    totalBagVolume: {
      type: Number,
    },
    currentAvailableBagVolume: {
      type: Number,
    },
    tours: [
      [
        {
          orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
          timing: String,
        },
      ],
    ],
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const Rider = mongoose.model("Rider", riderSchema);
module.exports = Rider;
