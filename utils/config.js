require("dotenv").config();

let PORT = process.env.PORT;
let NODE_ENV = process.env.NODE_ENV;
let GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
let MONGODB_URI = process.env.MONGODB_URI;

module.exports = {
  PORT,
  NODE_ENV,
  GOOGLE_MAPS_API_KEY,
  MONGODB_URI,
};
