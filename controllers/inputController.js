const reader = require("xlsx");
const { Client } = require("@googlemaps/google-maps-services-js");

const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { GOOGLE_MAPS_API_KEY } = require("../utils/config");

const client = new Client({});

// Reading data from the first sheet of file
const readExcelFile = (tempFilePath) => {
  const file = reader.readFile(tempFilePath);

  const sheetName = file.SheetNames[0];
  const sheet = file.Sheets[sheetName];

  const data = reader.utils.sheet_to_json(sheet);

  return data;
};

//Get geocode of Address using Google Maps API
const getGeocode = async (address) => {
  try {
    const args = {
      params: {
        key: GOOGLE_MAPS_API_KEY,
        address: address,
        region: "IN",
      },
    };
    const gcResponse = await client.geocode(args);

    const status = gcResponse.data.status;
    const firstResult = gcResponse.data.results[0];

    return { status, result: firstResult };
  } catch (e) {
    throw new AppError(
      `Unable to retrive geocode of the address ${address}: ${e.message}`,
      e.statusCode
    );
  }
};

const convertAddressToGeocode = async (data) => {
  try {
    await Promise.all(
      data.map(async (order) => {
        if (order.address) {
          const geocodeResponse = await getGeocode(order.address);

          const details = {
            inputAddress: order.address,
            formattedAddress: geocodeResponse.result.formatted_address,
            location: geocodeResponse.result.geometry.location,
            locationType: geocodeResponse.result.geometry.location_type,
          };
          order.location = details.location;
        } else {
          console.log(`Address not present in the order details ${order.AWB}`);
        }
      })
    );
  } catch (e) {
    console.log(e.message);
  }
};

//Expects a filename to be rawData
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

  res.status(200).json({
    message: "Data read and address conversion Successful",
    results: data.length,
    data,
  });
});

module.exports = { inputDeliveryPoints };
