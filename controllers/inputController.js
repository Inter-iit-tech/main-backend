const reader = require("xlsx");
const { Client } = require("@googlemaps/google-maps-services-js");

const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { GOOGLE_MAPS_API_KEY } = require("../utils/config");

const Product = require("../model/productModel");
const Order = require("../model/orderModel");

const client = new Client({});

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
 * Converts Address to the GeoSpatial Coordinates using Google Geocoding API
 * @param {String} address
 * @returns {{status, result}} Returns status of the conversion along with geolocation information 
 * for the first result given by the Google Geocoding API
 */
const getGeocode = async (address) => {
  try {
    const args = {
      params: {
        key: GOOGLE_MAPS_API_KEY,
        address: address,
        region: "IN",
        //TODO: add filtering based on Bangalore Data
      },
    };
    const gcResponse = await client.geocode(args);

    const status = gcResponse.data.status;
    const firstResult = gcResponse.data.results[0];

    const response = {
      status,
      result: {
        inputAddress: address,
        formattedAddress: firstResult.formatted_address,
        location: firstResult.geometry.location,
        locationType: firstResult.geometry.location_type,
      },
    };
    return response;
  } catch (e) {
    throw new AppError(
      `Unable to retrive geocode of the address ${address}: ${e.message}`,
      e.statusCode
    );
  }
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
      estimatedTime: new Date(), // TODO: this should be the estimated time
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
    volumetricWeight: volume,
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

module.exports = { inputDeliveryPoints, inputProductDetails, getGeocode };
