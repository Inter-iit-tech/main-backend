const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

const Product = require("../model/productModel");
const Order = require("../model/orderModel");
const Rider = require("../model/riderModel");

const {
  MAXIMUM_ACCEPTABLE_DISTANCE_IN_KM,
  DEPOT_SKU,
} = require("../utils/config");

const acceptableDistanceInKm = MAXIMUM_ACCEPTABLE_DISTANCE_IN_KM;

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
  const riderID = req.params.id;

  if (!riderID) {
    return next(new AppError("Rider ID not specified", 400));
  }

  const rider = await Rider.findById(riderID);

  // if (!rider) {
  //   return next(new AppError("Rider not found", 404));
  // }
  console.log({ rider });

  const noOfTours = rider.tours.length;
  let arr = [];
  for (let i = 0; i < noOfTours; i++) {
    arr.push(`tours.${i}.orderId `);
  }
  let path = arr.join("");
  path = path.slice(0, path.length - 1);

  await rider.populate({
    path,
    model: "Order",
    options: { strictPopulate: false },
  });

  res.status(200).json({
    message: "Fetched rider's details successfully",
    rider,
  });
});

/**
 * Function to serve HTTP request for marking the status delivery of the order
 */
const markOrderStatus = catchAsync(async (req, res, next) => {
  const riderID = req.params.id;
  const orderID = req.params.orderID;

  const status = req.body.order.status;
  const location = req.body.order.location;
  const userLocation = req.body.order.riderLocation;

  if (!riderID || !orderID) {
    return next(new AppError("Bad Request", 400));
  }

  const rider = await Rider.findById(riderID);

  if (!rider) {
    return next(new AppError("Rider not found", 404));
  }

  const currentDeliveryLocation = rider?.tours?.[0]?.[0]?.orderId;
  console.log({ orderID, currentDeliveryLocation });
  if (!currentDeliveryLocation.equals(orderID)) {
    return next(new AppError("This is not the next deliveryLocation", 400));
  }

  const tours = rider?.tours;
  tours[0].splice(0, 1);
  if (tours[0].length < 0) {
    tours.splice(0, 1);
  }

  const depot_SKU = DEPOT_SKU;
  const depot = await Order.findOne({ product: depot_SKU });
  const depotOrderID = depot._id;

  console.log({ depot, depotOrderID });

  if (!depotOrderID.equals(orderID)) {
    const updateObject = { isDelivered: status, isFakeAttempt: false };

    // TODO: Get location of rider and check if the rider is the acceptable distance from the drop location.
    const dist = getDistanceFromLatLonInKm(location, userLocation);
    if (dist > acceptableDistanceInKm) {
      updateObject.isFakeAttempt = true;
      console.log("This is a fake attempt");
    }
    const updateOrder = await Order.findByIdAndUpdate(orderID, updateObject);
  }

  const deliveredOrders = rider.deliveredOrders || [];
  deliveredOrders.push(orderID);

  const updateRider = await Rider.findByIdAndUpdate(riderID, {
    tours,
    deliveredOrders,
  });

  res.status(200).json({
    message: "Order status updated successfully",
  });
});

/*
  Function to update tokenId
*/
const updateTokenId = catchAsync(async (req, res, next) => {
  const { phoneNumber } = req.params;
  const { token } = req.body;
  if (!token) {
    return next(new AppError("Token not present", 404));
  }
  let rider = await Rider.findOneAndUpdate(
    { phoneNumber: phoneNumber },
    { expoTokenId: token },
    { new: true }
  );

  if (!rider) {
    // Create new rider
    rider = await Rider.create({
      phoneNumber: phoneNumber,
      expoTokenId: token,
    });
  }

  res.status(200).json({
    status: "success",
    rider: rider,
  });
});

/*
  Function to update tokenId
*/
const loginById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  let rider = await Rider.findOne({ riderID: id });

  if (!rider) {
    // Create new rider
    return next(new AppError("Rider not present", 404));
  }

  res.status(200).json({
    status: "success",
    rider: rider,
  });
});

module.exports = { getRiderDetailsOfTheDay, markOrderStatus, updateTokenId , loginById };
