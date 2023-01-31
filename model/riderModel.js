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
    tours: {
      // type: Array[{
      type: Array[{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
      // }],
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const Rider = mongoose.model("Rider", riderSchema);
module.exports = Rider;
