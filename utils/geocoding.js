const { Client } = require("@googlemaps/google-maps-services-js");
const AppError = require("../utils/appError");
const { GOOGLE_MAPS_API_KEY } = require("../utils/config");

const client = new Client({});

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

module.exports = { getGeocode };
