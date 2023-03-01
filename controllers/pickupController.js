const axios = require("axios");
const moment = require("moment");
const reader = require("xlsx");

const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

const Product = require("../model/productModel");
const Order = require("../model/orderModel");
const Rider = require("../model/riderModel");

const { getGeocode } = require("../utils/geocoding");
const { ORDER_ALLOCATION_SERVER_URL, DEPOT_SKU } = require("../utils/config");

const baseUrl = ORDER_ALLOCATION_SERVER_URL;

const readExcelFile = (tempFilePath) => {
  const file = reader.readFile(tempFilePath);

  const sheetName = file.SheetNames[0];
  const sheet = file.Sheets[sheetName];

  const data = reader.utils.sheet_to_json(sheet);

  return data;
};

const convertAddressToGeocode = async (data) => {
  let splicedData = [];
  while (data.length > 0) {
    splicedData.push(data.splice(0, 54));
  }

  let correct = 0;
  let incorrect = 0;

  const callGeolocationApi = async () => {
    for (const array of splicedData) {
      await Promise.all(
        array.map(async (order) => {
          try {
            if (order.addresses) {
              const geocodeResponse = await getGeocode(order.addresses);
              order.location = geocodeResponse.result.location;
              correct++;
            } else {
              console.log(
                `Address not present in the order details ${order.awb}`
              );
            }
          } catch (err) {
            console.log(err.message);
            console.log(
              `Cannot find address in the order details ${order.awb}`
            );
            incorrect++;
          }
        })
      );
      await sleep(1000);
    }
  };

  await callGeolocationApi();

  console.log({ correct, incorrect });

  const res = [];
  for (const array of splicedData) {
    for (const order of array) {
      res.push(order);
    }
  }

  return res;
};

const getProductIDs = async (orders, addTime) => {
  try {
    const newOrders = [];

    await Promise.all(
      orders.map(async (pickup) => {
        try {
          if (pickup.product_id) {
            console.log({ pickup });

            const { names, addresses, product_id, awb, location } = pickup;

            const estimatedTime = "0 23:59:59";

            const dbProduct = await Product.findOne({ skuID: product_id });
            const productID = dbProduct?._id;

            const orderObject = {
              AWB: awb,
              names,
              address: addresses,
              product: product_id,
              productID,
              estimatedTime,
              location,
              type: "pickup",
              addTime,
            };

            const createdOrder = await Order.create(orderObject);

            const newOrder = {
              ...formatOrder(createdOrder._doc),
              package: { volume: Math.ceil(dbProduct.volume) },
            };

            newOrders.push(newOrder);
          } else {
            console.log(`Product ID is not in the order details ${pickup.awb}`);
          }
        } catch (err) {
          console.log(err);
        }
      })
    );

    return newOrders;
  } catch (e) {
    console.log(e.message);
  }
};

// Formatting
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

const formatNewOrderPickup = (dbOrder) => {
  // console.log({ dbOrder });

  return {
    id: dbOrder._id,
    orderType: dbOrder.type,
    point: {
      longitude: dbOrder.location.lng,
      latitude: dbOrder.location.lat,
    },
    expectedTime: `0 23:59:59`,
    package: {
      volume: Math.ceil(dbOrder.productID.volume),
    },
  };
};

const formatNewOrder = (dbOrder) => {
  console.log({ dbOrder });

  return {
    id: dbOrder._id,
    orderType: dbOrder.orderType,
    point: {
      longitude: dbOrder.point.longitude,
      latitude: dbOrder.point.latitude,
    },
    expectedTime: `0 23:59:59`,
    package: dbOrder.package,
  };
};

const formatTour = (tour) => {
  return tour.map((el) => ({ orderId: el.orderId, timing: el.timing }));
};

// Main Formatting
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

  const newO = newOrders.map(formatNewOrderPickup);

  const requestBody = { riders, orders, depot, newOrders: newO };
  return requestBody;
};

const sleep = (duration) => {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
};

const callAddPickupFunction = async (req, res, next) => {
  try {
    const addTime = req.body.addTime;
    if (!addTime) {
      return next(new AppError("no addtime", 400));
    }

    const riders = await Rider.find();

    const orders = await Order.find({
      isDelivered: false,
      type: "delivery",
      location: { $ne: null },
    }).populate({
      path: "productID",
      model: "Product",
    });

    const depotIndex = orders.findIndex((order) => order.product === DEPOT_SKU);
    const depot = orders[depotIndex];
    orders.splice(depotIndex, 1);

    const newOrders = await Order.find({
      type: "pickup",
      addTime: addTime,
      location: { $ne: null },
    }).populate({
      path: "productID",
      model: "Product",
    });

    const requestBody = {
      ...formatRequestBodyToAddPickup(riders, orders, depot, newOrders),
      currentTime: addTime,
    };

    // Making request
    const response = await axios.post(
      `${baseUrl}/api/solve/addorder/`,
      requestBody
    );

    // console.log({ response });

    const allocatedRiders = response?.data?.riders;

    await Promise.all(
      allocatedRiders?.map(async (rider) => {
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
      data: { request: requestBody, response: response.data },
    });
  } catch (err) {
    // console.log({ err });
    console.dir({ r: err?.response?.data }, { depth: null });
    res.status(500).json({
      r: err?.response?.data,
      message: err.message,
      r: err.stack,
    });
  }
};

const inputPickupDetails = async (req, res, next) => {
  try {
    const file = req.files?.rawData;
    const addTime = req.body.addTime;
    if (!addTime) {
      return next(new AppError("no addtime", 400));
    }

    if (!file) {
      return next(new AppError("File not found", 400));
    }

    const acceptedFileMimeTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!acceptedFileMimeTypes.includes(file.mimetype)) {
      return next(new AppError("Please select an Excel File", 400));
    }

    let data = readExcelFile(file.tempFilePath);

    data = await convertAddressToGeocode(data);

    const newOrders = await getProductIDs(data, addTime);

    res.status(200).json({
      message: "Success",
      data: { newOrders },
    });
  } catch (err) {
    console.log({ err });
    console.dir({ r: err?.response?.data }, { depth: null });
    res.status(500).json({
      message: err.message,
      r: err.stack,
    });
  }
};

const demo = async (req, res, next) => {
  await Order.deleteMany({ type: "pickup" });
  res.sendStatus(204);
};

module.exports = {
  inputPickupDetails,
  callAddPickupFunction,
  demo,
};

//TODO: output format of the Grow Simplee
//TODO: Notification check
//TODO: Front end simulation
