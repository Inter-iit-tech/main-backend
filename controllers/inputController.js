const reader = require("xlsx");
const moment = require("moment");

const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

const Product = require("../model/productModel");
const Order = require("../model/orderModel");
const Rider = require("../model/riderModel");

const { getGeocode } = require("../utils/geocoding");

const randomIntFromInterval = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

/**
 * Reads data from the first sheet of excel file and converts it to JSON
 * @param {String} tempFilePath
 * @returns {[Object]} Array of JSON object with keys being the first row.
 */
const readExcelFile = (tempFilePath) => {
  const file = reader.readFile(tempFilePath);

  const sheetName = file.SheetNames[0];
  const sheet = file.Sheets[sheetName];

  const data = reader.utils.sheet_to_json(sheet);

  return data;
};

/**
 * Converts the address from the order to the GeoSpatial Coordinates and appends the result to the order object
 * @param {[Objects]} data
 */
const convertAddressToGeocode = async (data) => {
  try {
    await Promise.all(
      data.map(async (order) => {
        if (order.address) {
          const geocodeResponse = await getGeocode(order.address);
          order.location = geocodeResponse.result.location;
        } else {
          console.log(`Address not present in the order details ${order.AWB}`);
        }
      })
    );
  } catch (e) {
    console.log(e.message);
  }
};

/**
 * Gets mongoose Product ID from the product SKU_ID from the order and appends the result to the order object
 * @param {[Objects]} orders
 */
const getProductIDs = async (orders) => {
  try {
    await Promise.all(
      orders.map(async (order) => {
        if (order.product_id) {
          const product = await Product.findOne({ skuID: order.product_id });
          order.productID = product._id;
        } else {
          console.log(`Product ID is not in the order details ${order.AWB}`);
        }
      })
    );
  } catch (e) {
    console.log(e.message);
  }
};

/**
 * Function to serve the HTTP request of taking the raw data as input and storing the orders information from an Excel sheet
 */
const inputDeliveryPoints = catchAsync(async (req, res, next) => {
  const file = req.files?.rawData;

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

  const data = readExcelFile(file.tempFilePath);

  await convertAddressToGeocode(data);

  await getProductIDs(data);

  const newOrders = data.map((order) => {
    return {
      AWB: order.AWB,
      names: order.names,
      product: order.product_id,
      productID: order.productID,
      address: order.address,
      estimatedTime: moment().add(randomIntFromInterval(200, 600), "m"), // TODO: this should be the estimated time from the input
      location: order.location,
    };
  });

  const orders = await Order.insertMany(newOrders);

  res.status(200).json({
    message: "Data read and address conversion Successful",
    results: data.length,
    data: orders,
  });
});

/**
 * Function to serve HTTP request of taking details of product and storing it to the Database.
 */
const inputProductDetails = catchAsync(async (req, res, next) => {
  const product = req.body.product;

  if (!product) {
    return next(new AppError("Product not found", 400));
  }

  const { skuID, volume, deadWeight, length, breadth, height } = product;

  if (!skuID || !volume || !deadWeight) {
    return next(new AppError("All mandatory product details not present", 400));
  }

  const data = {
    skuID,
    volume,
    deadWeight,
    length,
    breadth,
    height,
  };

  const newProduct = await Product.create(data);

  console.log({ newProduct });

  res.status(201).json({
    status: "success",
    message: `Product details with SKU:${newProduct.skuID} inserted successfully`,
  });
});

const inputDummyProducts = catchAsync(async (req, res, next) => {
  const file = req.files?.rawData;

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

  const data = readExcelFile(file.tempFilePath);

  await Product.insertMany(data);

  res.status(200).json({ message: "Product inserted successfully" });
});

const inputRiderDetails = catchAsync(async (req, res, next) => {
  const file = req.files?.rawData;

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

  const data = readExcelFile(file.tempFilePath);

  await Rider.insertMany(data);

  res.status(200).json({ message: "Riders inserted successfully" });
});

const inputDepotLocation = catchAsync(async (req, res, next) => {
  const location = req.body.location;

  const depotProduct = await Product.create({
    skuID: "SKU_0000000000",
    volume: 20,
  });

  const depotOrder = await Order.create({
    AWB: 00000000000,
    names: "Depot Location",
    product: "SKU_0000000000",
    productID: depotProduct._id,
    address: "Depot Location",
    estimatedTime: moment().add(randomIntFromInterval(200, 600), "m"),
    location: location,
  });

  res.status(201).json({
    message: "Depot Location created successfully",
    data: { depotOrder, depotProduct },
  });
});

module.exports = {
  inputDeliveryPoints,
  inputProductDetails,
  inputDummyProducts,
  inputRiderDetails,
  inputDepotLocation
};
