const axios = require("axios");
const moment = require("moment");
const reader = require("xlsx");

const { Expo } = require("expo-server-sdk");

const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

const Product = require("../model/productModel");
const Order = require("../model/orderModel");
const Rider = require("../model/riderModel");

const { getGeocode } = require("../utils/geocoding");
const { sendNotification } = require("./notificationController");
const { ORDER_ALLOCATION_SERVER_URL, DEPOT_SKU } = require("../utils/config");

const baseUrl = ORDER_ALLOCATION_SERVER_URL;

const readExcelFile = (tempFilePath) => {
  const file = reader.readFile(tempFilePath);

  const sheetName = file.SheetNames[0];
  const sheet = file.Sheets[sheetName];

  const data = reader.utils.sheet_to_json(sheet);

  return data;
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
 * Function to create pickup object with mongoose objects.
 * @async
 * @param {{names, address, product}} pickup
 * @returns Object with all mongoose properties
 */
const createPickupOrderObject = async (pickup) => {
  try {
    const { names, address, product, AWB } = pickup;

    const estimatedTime = new Date();

    const geocodeResponse = await getGeocode(address);
    const location = geocodeResponse.result.location;

    const dbProduct = await Product.findOne({ skuID: product });
    const productID = dbProduct?._id;

    const orderObject = {
      AWB,
      names,
      address,
      product,
      productID,
      estimatedTime,
      location,
      type: "pickup",
    };

    return { order: orderObject, volume: dbProduct?.volume };
  } catch (e) {
    console.error(e);
    throw new AppError("Error in creating the order object" + e.message, 400);
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

  // Making request
  const response = await axios.post(
    `${baseUrl}/api/solve/addorder/`,
    requestBody
  );

  // check if any rider has updatedCurrentTour true
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
  await Promise.all(
    response.rider.map(async (rider) => {
      try {
        await Rider.findByIdAndUpdate(rider.id, { tours: rider.tours });
      } catch (e) {
        console.log("Error in updating the riders");
      }
    })
  );

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

  // console.dir(requestBody, { depth: null });

  // Making request
  const response = await axios.post(
    `${baseUrl}/api/solve/delorder/`,
    requestBody
  );

  // console.log({ response });

  // check if any rider has updated_current_tour true
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
  await Promise.all(
    response.rider.map(async (rider) => {
      try {
        await Rider.findByIdAndUpdate(rider.id, { tours: rider.tours });
      } catch (e) {
        console.log("Error in updating the riders");
      }
    })
  );

  res.status(200).json({
    message: responseMsg,
    data: response.data,
    requestBody,
    // changedRiders: routeChangedRiders,
  });
});

const formatOrder = (dbOrder) => {
  const time = Math.abs(moment().diff(dbOrder.estimatedTime, "days"));

  return {
    id: dbOrder._id,
    orderType: dbOrder.type,
    point: {
      longitude: dbOrder.location.lng,
      latitude: dbOrder.location.lat,
    },
    expectedTime: `${time} 23:59:59`,
    package: {
      volume: Math.ceil(dbOrder.productID.volume),
    },
  };
};

const formatNewOrder = (dbOrder) => {
  // const time = Math.abs(moment().diff(dbOrder.estimatedTime, "days"));

  console.log({ dbOrder });

  return {
    id: dbOrder._id,
    orderType: dbOrder.type,
    point: {
      longitude: dbOrder.location.longitude,
      latitude: dbOrder.location.latitude,
    },
    expectedTime: `0 23:59:59`,
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

const formatRequestBodyToAddPickup = (
  dbRiders,
  dbOrders,
  depotLocation,
  newOrders
) => {
  const riders = dbRiders.map((dbRider) => {
    return {
      id: dbRider._id,
      vehicle: {
        capacity: Math.ceil(dbRider.totalBagVolume)
          ? Math.ceil(dbRider.totalBagVolume)
          : 640000,
      },
      tours: dbRider.tours.map(formatTour),
      headingTo: dbRider.headingTo ? dbRider.headingTo : null,
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

  const newO = newOrders.map(formatNewOrder);

  const requestBody = { riders, orders, depot, newOrders: newO };
  return requestBody;
};

/**
 * Function to serve HTTP request for getting details about a day
 */
const adminDetails = async (req, res, next) => {
  let requestBody;
  try {
    const orders = await Order.find({ type: "delivery" }).populate({
      path: "productID",
      select: "volume",
      model: "Product",
    });
    const riders = await Rider.find();

    const depotIndex = orders.findIndex((order) => order.product === DEPOT_SKU);
    const depot = orders[depotIndex];
    orders.splice(depotIndex, 1);

    requestBody = formatRequestBody(riders, orders, depot);

    console.dir({ r: requestBody.riders }, { depth: null });

    const response = await axios.post(
      `${baseUrl}/api/solve/startday/`,
      requestBody
    );

    console.log({ response });

    const ordersSent = orders.length;

    let orderInRiders = 0;

    const allocatedRiders = response.data.riders;

    allocatedRiders.forEach((rider) => {
      rider.tours.forEach((tour) => {
        orderInRiders += tour.length - 2;
      });
    });

    await Promise.all(
      allocatedRiders.map(async (rider) => {
        try {
          await Rider.findByIdAndUpdate(rider.id, { tours: rider.tours });
        } catch (e) {
          console.log("Error in updating the riders");
        }
      })
    );

    const updatedRiders = await Rider.find();

    res.status(200).json({
      message: "Success",
      // data: { orders, riders: updatedRiders, depot },
      data: {
        ordersSent,
        orderInRiders,
        requestBody,
        responseBody: response.data,
        updatedRiders,
      },
    });
  } catch (e) {
    // console.log(e);
    console.log({ e });
    console.dir(e?.response?.data, { depth: null });
    res.status(500).json({ error: e?.response?.data, requestBody });
  }
};

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

    case "home":
      let ordersData = {};
      ordersData.deliveries = await Order.count({ type: "delivery" });
      ordersData.pickups = await Order.count({ type: "pickup" });
      let riderData = { count: await Rider.count() };
      data = { ordersData, riderData };
      break;
  }

  res.status(200).json({
    status: "success",
    data: data,
  });
});

const getRiderDetailsForAdmin = catchAsync(async (req, res, next) => {
  const riders = await Rider.find();

  await Promise.all(
    riders.map(async (rider) => {
      const noOfTours = rider.tours.length;
      let arr = [];
      for (let i = 0; i < noOfTours; i++) {
        arr.push(`tours.${i}.orderId `);
      }
      let path = arr.join("");
      path = path.slice(0, path.length - 1);
      if (path !== "") {
        await rider.populate({
          path,
          model: "Order",
          options: { strictPopulate: false },
        });
      }
    })
  );

  console.dir({ riders }, { depth: 2 });

  res.status(200).json({ status: "success", data: riders });
});

const sleep = (duration) => {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
};

const clearPickups = async (req, res, next) => {
  await Order.deleteMany({ type: "pickup" });
  res.sendStatus(204);
};

module.exports = {
  addPickup,
  adminDetails,
  getDetails,
  deletePickup,
  clearPickups,
  getRiderDetailsForAdmin,
};
