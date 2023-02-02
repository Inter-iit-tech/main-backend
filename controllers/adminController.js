const axios = require("axios");
const moment = require("moment");
const { Expo } = require("expo-server-sdk");

const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

const Product = require("../model/productModel");
const Order = require("../model/orderModel");
const Rider = require("../model/riderModel");

const { getGeocode } = require("../utils/geocoding");

const baseUrl = "http://192.168.137.128:8010";

/**
 * Function to send notification to the mobile device.
 * @param {String} pushToken
 * @param {String} message
 * @param {Object} data
 */
const sendNotification = async (pushToken, message, data) => {
  // Expo Client
  const expo = new Expo();

  const messages = [
    {
      to: pushToken,
      sound: "default",
      body: message,
      data: data,
    },
  ];

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  // Send chunks of notification
  (async () => {
    for (let chunk of chunks) {
      try {
        let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        console.log(ticketChunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error(error);
      }
    }
  })();
};

/**
 * Start of the day function called by the cron job.
 */
const startOfTheDayCall = async () => {
  try {
    const orders = await Order.find({ isDelivered: false });
    const riders = await Rider.find();

    //TODO: add API CALL to call the Route Allocation Service
    const ridersAllocated = await axios.get(`${baseUrl}/allocation`, {
      orders,
      riders,
    });

    //Expected response riders updated
    await Promise.all(
      ridersAllocated.map(async (rider) => {
        try {
          const updatedRider = await Rider.findByIdAndUpdate(rider._id, {
            tours: rider.tours,
          });
        } catch (e) {
          console.log(e.message);
        }
      })
    );
  } catch (e) {
    console.log(e);
    throw new AppError(
      "Error in calling the Route Allocation Service" + e.message,
      400
    );
  }
};

/**
 * Function to check if tours are equal
 * @param {[Order]} a
 * @param {[Order]} b
 * @returns Boolean
 */
const areTourArraysEqual = (a, b) => {
  // length of arrays
  if (a.length !== b.length) {
    return false;
  }
  // each element
  a.forEach((ele) => {
    if (b.findIndex((e) => e._id !== ele._id) === -1) {
      return false;
    }
  });

  return true;
};

/**
 * Function to create pickup object with mongoose objects.
 * @param {{names, address, product}} pickup
 * @returns Object with all mongoose properties
 */
const createPickupOrderObject = async (pickup) => {
  try {
    const { names, address, product } = pickup;

    const randomAWB = Math.floor(1000000000 + Math.random() * 9000000000);
    const estimatedTime = new Date();

    const geocodeResponse = await getGeocode(address);
    const location = geocodeResponse.result.location;

    const dbProduct = await Product.findOne({ skuID: product });
    const productID = dbProduct._id;

    const orderObject = {
      AWB: randomAWB,
      names,
      address,
      product,
      productID,
      estimatedTime,
      location,
      type: "pickup",
    };

    return orderObject;
  } catch (e) {
    console.error(e);
    throw new AppError("Error in creating the order object", 400);
  }
};

const addPickup = catchAsync(async (req, res, next) => {
  // Create a new order object of type pickup
  const order = req.body.order;
  const orderObject = await createPickupOrderObject(order);
  const newOrder = await Order.create(orderObject);

  // // TODO: Add API call for adding dynamic pickup
  // //expected response riders updated
  // const ridersAllocated = await axios.get(`${baseUrl}/allocation/`, {
  //   newOrder,
  // });

  // // original riders in the database
  // const riders = await Rider.find();

  // // Array to maintain the riders with changed routes
  // const routeChangedRiders = [];

  // // Check for riders if they have changed tours
  // riders.forEach(async (rider) => {
  //   try {
  //     const riderInConsideration = ridersAllocated.find(
  //       (r) => r._id === rider._id
  //     );

  //     if (!areTourArraysEqual(riderInConsideration.tours, r.tours)) {
  //       routeChangedRiders.push(r);

  //       const updateRider = await Rider.findByIdAndUpdate(r._id, {
  //         tours: riderInConsideration.tours,
  //       });
  //     }
  //   } catch (e) {
  //     console.log(e);
  //   }
  // });

  // routeChangedRiders.forEach(async (rider) => {
  //   //TODO: Add function to send firebase notifications to the riders whose routes are updated
  //   await sendNotification(rider.firebaseMessagingId, "Hello, Android user!");
  // });

  res.status(200).json({
    message: "Pickup added successfully and notification sent to riders!",
    data: { order: newOrder },
  });
});

const deletePickup = catchAsync(async (req, res, next) => {
  const order = req.query.order;

  //TODO: add API call to deletion pickup
  res.status(200).json({ message: "Delete Pickup" });
});

const formatRequestBodyForStartDay = (dbRiders, dbOrders, depotLocation) => {
  const riders = dbRiders.map((dbRider) => {
    return {
      id: dbRider._id,
      vehicle: {
        capacity: Math.ceil(dbRider.totalBagVolume),
      },
      //TODO: Check if this has to be dynamic
      startTime: "09:00:00",
    };
  });

  const orders = dbOrders.map((dbOrder) => {
    return {
      id: dbOrder._id,
      orderType: dbOrder.type,
      point: {
        longitude: dbOrder.location.lng,
        latitude: dbOrder.location.lat,
      },
      expectedTime: `${moment(dbOrder.estimatedTime).format("HH:mm:ss")}`,
      package: {
        volume: Math.ceil(dbOrder.productID.volume),
      },
    };
  });

  const depot = {
    id: depotLocation._id,
    point: {
      latitude: depotLocation.location.lat,
      longitude: depotLocation.location.lng,
    },
  };

  const requestBody = { riders, orders, depot };
  return requestBody;
};

/**
 * Function to serve HTTP request for getting details about a day
 */
const adminDetails = catchAsync(async (req, res, next) => {
  const orders = await Order.find().populate({
    path: "productID",
    select: "volume",
    model: "Product",
  });
  const riders = await Rider.find();

  const depotIndex = orders.findIndex(
    (order) => order.product === "SKU_0000000000"
  );
  const depot = orders[depotIndex];
  orders.splice(depotIndex, 1);

  const requestBody = formatRequestBodyForStartDay(riders, orders, depot);
  const response = await axios.post(
    `${baseUrl}/api/solve/startday/`,
    requestBody
  );

  const { data } = response;
  const allocatedRiders = data.riders;

  await Promise.all(
    allocatedRiders.map(async (rider) => {
      await Rider.findByIdAndUpdate(rider.id, { tours: rider.tours });
    })
  );

  const updatedRiders = await Rider.find();

  res.status(200).json({
    message: "Success",
    data: { orders, riders: updatedRiders, depot },
  });
});

module.exports = { addPickup, adminDetails };
