require("dotenv").config();

let PORT = process.env.PORT;
let NODE_ENV = process.env.NODE_ENV;
let GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
let MONGODB_URI = process.env.MONGODB_URI;
let EXPO_ACCESS_TOKEN = process.env.EXPO_ACCESS_TOKEN;

module.exports = {
  PORT,
  NODE_ENV,
  GOOGLE_MAPS_API_KEY,
  MONGODB_URI,
  EXPO_ACCESS_TOKEN,
};
