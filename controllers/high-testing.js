const axios = require("axios");
const moment = require("moment");
const reader = require("xlsx");

const AppError = require("../utils/appError");

const { v4: uuidv4 } = require("uuid");
const { ORDER_ALLOCATION_SERVER_URL, DEPOT_SKU } = require("../utils/config");
const baseUrl = ORDER_ALLOCATION_SERVER_URL;

const a = require("../samples/a.json");

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

const randomIntFromInterval = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

const formatOrder = (dbOrder) => {
  const time = randomIntFromInterval(0, 4);
  const id = uuidv4();
  const volume = randomIntFromInterval(10, 32000);
  return {
    id: id,
    orderType: "delivery",
    point: {
      longitude: dbOrder.longitude,
      latitude: dbOrder.latitude,
    },
    expectedTime: `${time} 23:59:59`,
    package: {
      volume: volume,
    },
  };
};

const BangaloreCoordinates = {
  latitude: 12.9063958,
  longitude: 77.5886106,
  latitudeDelta: 0.015,
  longitudeDelta: 0.0121,
};

const constructRiders = (number) => {
  const riders = [];
  for (let i = 0; i < number; i++) {
    riders.push({
      id: uuidv4(),
      vehicle: {
        capacity: randomIntFromInterval(0, 1) === 0 ? 480000 : 640000,
      },
      startTime: "09:00:00",
    });
  }

  return riders;
};

const startOfTheDayCall = async (req, res, next) => {
  let requestBody;
  try {
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

    let data = readExcelFile(file.tempFilePath);

    const orders = data.map(formatOrder);

    const riders = constructRiders(30);

    const depot = {
      id: uuidv4(),
      point: {
        latitude: BangaloreCoordinates.latitude,
        longitude: BangaloreCoordinates.longitude,
      },
    };

    requestBody = { orders, riders, depot };

    // requestBody = formatRequestBody(riders, orders, depot);

    // console.log({ requestBody });

    // console.dir({ r: requestBody.riders }, { depth: null });

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

    // // const { data } = response;
    // // res.status(200).json(data);

    // // const allocatedRiders = data.riders;

    // // await Promise.all(
    // //   allocatedRiders.map(async (rider) => {
    // //     try {
    // //       await Rider.findByIdAndUpdate(rider.id, { tours: rider.tours });
    // //     } catch (e) {
    // //       console.log("Error in updating the riders");
    // //     }
    // //   })
    // // );

    // // const updatedRiders = await Rider.find();

    res.status(200).json({
      message: "Success",
      data: {
        ordersSent,
        orderInRiders,
        requestBody,
        responseBody: response.data,
      },
    });
  } catch (err) {
    console.log({ err });
    res.status(500).json({ err });
  }
};

const getLengths = async (req, res, next) => {
  const resp = a;

  a.data.request.riders.forEach((rider) => {
    console.log({ riderID: rider.id });
    console.log({ toursLEng: rider.tours[0].length });
  });
};

module.exports = { startOfTheDayCall, getLengths };
