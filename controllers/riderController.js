const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

const Product = require("../model/productModel");
const Order = require("../model/orderModel");
const Rider = require("../model/riderModel");

const acceptableDistanceInKm = 0.5;

/**
 * Get the distance between two coordinates in km
 * @param {{lat, lng}} location1
 * @param {{lat, lng}} location2
 * @returns
 */
const getDistanceFromLatLonInKm = (location1, location2) => {
  const lat1 = location1.lat;
  const lon1 = location1.lng;
  const lat2 = location2.lat;
  const lon2 = location2.lng;

  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2 - lat1); // deg2rad below
  var dLon = deg2rad(lon2 - lon1);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c; // Distance in km
  return d;
};

const deg2rad = (deg) => {
  return deg * (Math.PI / 180);
};

/**
 * Function to serve HTTP request for the get rider details
 */
const getRiderDetailsOfTheDay = catchAsync(async (req, res, next) => {
  const riderID = req.param.id;

  const rider = await Rider.findById(riderID).populate({ tours });

  res.status(200).json({
    message: "Fetch Riders' details successfully",
    rider,
  });
});

/**
 * Function to serve HTTP request for marking the status delivery of the order
 */
const markOrderStatus = catchAsync(async (req, res, next) => {
  const rider = req.param.id;
  const orderID = req.body.orderID;

  const status = req.body.order.status;
  const location = req.body.order.location;
  const userLocation = req.body.order.riderLocation;

  const updateObject = { isDelivered: status, isFakeAttempt: false };
  if (!status) {
    // TODO: Get location of rider and check if the rider is the acceptable distance from the drop location.
    const dist = getDistanceFromLatLonInKm(location, userLocation);

    if (dist > acceptableDistanceInKm) {
      //TODO: Mark this as a fake attempt of delivery
      updateObject.isFakeAttempt = true;
    }
  }

  const updateOrder = await Order.findByIdAndUpdate(orderID, updateObject);

  res.status(200).json({
    message: "Order status updated successfully",
  });
});

module.exports = { getRiderDetailsOfTheDay, markOrderStatus };
