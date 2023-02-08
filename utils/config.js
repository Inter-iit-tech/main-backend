require("dotenv").config();

let PORT = process.env.PORT;
let NODE_ENV = process.env.NODE_ENV;
let GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
let MONGODB_URI = process.env.MONGODB_URI;
let EXPO_ACCESS_TOKEN = process.env.EXPO_ACCESS_TOKEN;
let ORDER_ALLOCATION_SERVER_URL = process.env.ORDER_ALLOCATION_SERVER_URL;
let MAXIMUM_ACCEPTABLE_DISTANCE_IN_KM =
  process.env.MAXIMUM_ACCEPTABLE_DISTANCE_IN_KM;
let DEPOT_SKU = process.env.DEPOT_SKU;

module.exports = {
  PORT,
  NODE_ENV,
  GOOGLE_MAPS_API_KEY,
  MONGODB_URI,
  EXPO_ACCESS_TOKEN,
  ORDER_ALLOCATION_SERVER_URL,
  MAXIMUM_ACCEPTABLE_DISTANCE_IN_KM,
  DEPOT_SKU,
};
