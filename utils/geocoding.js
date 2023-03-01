const { Client } = require("@googlemaps/google-maps-services-js");
const AppError = require("../utils/appError");
const { GOOGLE_MAPS_API_KEY } = require("../utils/config");

const client = new Client({});

/**
 * @async
 * @function getGeocode
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
        componentRestrictions: {
          administrativeArea: "Bengaluru",
          locality: "Bengaluru",
        },
      },
    };

    const gcResponse = await client.geocode(args);

    const status = gcResponse.data.status;

    const LAT_MIN = 12;
    const LAT_MAX = 15;
    const LNG_MIN = 77;
    const LNG_MAX = 79;

    // Set the first location in bounds as the approxResult
    // console.log({ r: gcResponse.data.results });
    let approxResult = gcResponse.data.results[0];

    for (const result of gcResponse.data.results) {
      const { lat, lng } = result.geometry.location;
      if (LAT_MIN < lat && lat < LAT_MAX && LNG_MIN < lng && lng < LNG_MAX) {
        approxResult = result;
        break;
      }
    }

    const response = {
      status,
      result: {
        inputAddress: address,
        formattedAddress: approxResult.formatted_address,
        location: approxResult.geometry.location,
        locationType: approxResult.geometry.location_type,
      },
    };

    return response;
  } catch (e) {
    console.log({ e });
    throw new AppError(
      `Unable to retrive geocode of the address ${address}: ${e.message}`,
      e.statusCode
    );
  }
};

module.exports = { getGeocode };
