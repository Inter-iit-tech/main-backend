const axios = require("axios");
const moment = require("moment");
const { Expo } = require("expo-server-sdk");

const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

const Product = require("../model/productModel");
const Order = require("../model/orderModel");
const Rider = require("../model/riderModel");

const { getGeocode } = require("../utils/geocoding");

const { sendNotification } = require("./notificationController");

const baseUrl = "http://192.168.137.128:8010";

/**
 * Function to send notification to the mobile device.
 * @param {String} pushToken
 * @param {String} message
 * @param {Object} data
 */
// const sendNotification = async (pushToken, message, data) => {
//   // Expo Client
//   const expo = new Expo();

//   const messages = [
//     {
//       to: pushToken,
//       sound: "default",
//       body: message,
//       data: data,
//     },
//   ];

//   const chunks = expo.chunkPushNotifications(messages);
//   const tickets = [];

//   // Send chunks of notification
//   (async () => {
//     for (let chunk of chunks) {
//       try {
//         let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
//         console.log(ticketChunk);
//         tickets.push(...ticketChunk);
//       } catch (error) {
//         console.error(error);
//       }
//     }
//   })();
// };

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

    return { order: orderObject, volume: dbProduct.volume };
  } catch (e) {
    console.error(e);
    throw new AppError("Error in creating the order object", 400);
  }
};

const addPickup = catchAsync(async (req, res, next) => {
  // Create a new order object of type pickup
  const order = req.body.order;
  const orderObject = await createPickupOrderObject(order);
  const createdOrder = await Order.create(orderObject.order);

  const newOrder = {
    ...formatOrder(createdOrder._doc),
    package: { volume: Math.ceil(orderObject.volume) },
  };

  const riders = await Rider.find();

  const orders = await Order.find({ isDelivered: false }).populate({
    path: "productID",
    model: "Product",
  });

  const depotIndex = orders.findIndex(
    (order) => order.product === "SKU_0000000000"
  );
  const depot = orders[depotIndex];

  // Formatting request body
  const requestBody = {
    ...formatRequestBodyToAddPickup(riders, orders, depot),
    newOrder,
  };
  // console.dir(requestBody, { depth: null });

  // requestBody.riders.map(rider => {
  //   console.dir(rider.tours, { depth: null })
  // })

  // Making request
  const response = await axios.post(
    `${baseUrl}/api/solve/addorder/`,
    requestBody
  );

  // console.log({ response });

  // check if any rider has updatedcurrenttour true
  const riderWithUpdatedCurrentTour = response?.data.riders.find(
    (rider) => rider.updateCurrentTour === true
  );
  console.log({ riderWithUpdatedCurrentTour });

  // send notification if any
  let responseMsg = "Pickup added successfully";
  if (riderWithUpdatedCurrentTour) {
    const riderTokenId = await Rider.findById(riderWithUpdatedCurrentTour._id)
      .expoTokenId;
    await sendNotification([
      {
        token: riderTokenId,
        notificationData: { msg: "Your current tour is rerouted!" },
      },
    ]);

    responseMsg += " and notification sent to rider!";
  }

  // Updating riders tours
  // await Promise.all(
  //   response.rider.map(async (rider) => {
  //     await Rider.findByIdAndUpdate(rider.id, { tours: rider.tours });
  //   })
  // );

  res.status(200).json({
    message: responseMsg,
    data: { order: newOrder },
  });
});

const deletePickup = catchAsync(async (req, res, next) => {
  const orderId = req.body.orderId;

  const riders = await Rider.find();

  const orders = await Order.find({ isDelivered: false }).populate({
    path: "productID",
    model: "Product",
  });

  const depotIndex = orders.findIndex(
    (order) => order.product === "SKU_0000000000"
  );
  const depot = orders[depotIndex];

  // Formatting request body
  const requestBody = {
    ...formatRequestBodyToAddPickup(riders, orders, depot),
    delOrderId: orderId,
  };

  console.dir(requestBody, { depth: null });

  // res.send(requestBody);

  // requestBody.riders.map(rider => {
  //   console.dir(rider.tours, { depth: null })
  // })

  // Making request
  const response = await axios.post(
    `${baseUrl}/api/solve/delorder/`,
    requestBody
  );

  // console.log({ response });

  // check if any rider has updatedcurrenttour true
  const riderWithUpdatedCurrentTour = response?.data.riders.find(
    (rider) => rider.updateCurrentTour === true
  );
  console.log({ riderWithUpdatedCurrentTour });

  // send notification if any
  let responseMsg = "Pickup deleted successfully";
  if (riderWithUpdatedCurrentTour) {
    const riderTokenId = await Rider.findById(riderWithUpdatedCurrentTour._id)
      .expoTokenId;
    await sendNotification([
      {
        token: riderTokenId,
        notificationData: { msg: "Your current tour is rerouted!" },
      },
    ]);

    responseMsg += " and notification sent to rider!";
  }

  // Updating riders tours
  // await Promise.all(
  //   response.rider.map(async (rider) => {
  //     await Rider.findByIdAndUpdate(rider.id, { tours: rider.tours });
  //   })
  // );

  res.status(200).json({
    message: responseMsg,
    data: response.data,
    requestBody,
    // changedRiders: routeChangedRiders,
  });
});

const formatOrder = (dbOrder) => {
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
};

const formatTour = (tour) => {
  return tour.map((el) => ({ orderId: el.orderId, timing: el.timing }));
};

const formatRequestBody = (dbRiders, dbOrders, depotLocation) => {
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

  const orders = dbOrders.map(formatOrder);

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

const formatRequestBodyToAddPickup = (dbRiders, dbOrders, depotLocation) => {
  const riders = dbRiders.map((dbRider) => {
    return {
      id: dbRider._id,
      vehicle: {
        capacity: Math.ceil(dbRider.totalBagVolume),
      },
      tours: dbRider.tours.map(formatTour),
      headingTo: dbRider.tours?.[0]?.[0]?.orderId || depotLocation._id,
    };
  });

  const orders = dbOrders.map(formatOrder);

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

  const requestBody = formatRequestBody(riders, orders, depot);

  // console.dir({ requestBody }, { depth: null })

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

const getDetails = catchAsync(async (req, res, next) => {
  const { reqQuery } = req.params;
  console.log(reqQuery);
  let data;

  switch (reqQuery) {
    case "pickups":
      data = await Order.find({ isDelivered: false, type: "pickup" });
      break;

    case "orders":
      data = await Order.find();
      break;

    case "riders":
      data = await Rider.find();
      break;
  }

  res.status(200).json({
    status: "success",
    data: data,
  });
});

module.exports = { addPickup, adminDetails, getDetails, deletePickup };
