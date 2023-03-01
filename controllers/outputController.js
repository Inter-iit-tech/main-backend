const axios = require("axios");
const moment = require("moment");
const Rider = require("../model/riderModel");

const converter = require("json-2-csv");
const fs = require("fs");

const { OSRM_MLD_SERVER_URL } = require("../utils/config");

const convertToCSV = async (output) => {
  try {
    // convert JSON array to CSV string
    const csv = await converter.json2csvAsync(output);

    // write CSV to a file
    fs.writeFileSync(
      `output/output${moment().format("DD-MM HH-mm-ss")}.csv`,
      csv
    );
    console.log("Written to the output file successfully");
  } catch (err) {
    console.log(err);
    throw err;
  }
};

const createOutput = async (req, res, next) => {
  try {
    console.log("Request Received");
    const riders = await Rider.find().populate({
      path: "tours.0.orderId",
      model: "Order",
    });

    console.log(riders);

    const output = await Promise.all(riders.map(outputFormat));

    // await convertToCSV(output);

    res.status(200).json({ output });
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
  }
};

const outputFormat = async (rider) => {
  const tour = rider.tours?.[0];
  let formattedOrders = [];
  if (tour !== null) {
    formattedOrders = await orderFormat(tour);
  }
  return {
    id: rider.riderID,
    orders: formattedOrders,
  };
};

const generateOSRMUri = (orders) => {
  const baseURL = OSRM_MLD_SERVER_URL;
  const endPoint = "route/v1/driving";

  const queryParams = {
    overview: "full",
    geometries: "polyline6",
    annotations: true,
  };

  //query-params
  let queryParamsString = "";

  for (const param in queryParams) {
    queryParamsString = queryParamsString.concat(
      `${param}=${queryParams[param]}&`
    );
  }

  queryParamsString = queryParamsString.slice(0, -1);

  //coordinates
  let coordinateString = "";

  orders.forEach((order) => {
    if (order?.orderId?.location) {
      coordinateString = coordinateString.concat(
        `${order?.orderId?.location?.lng},${order?.orderId?.location?.lat};`
      );
    }
  });

  coordinateString = coordinateString.slice(0, -1);

  const Uri = `${baseURL}/${endPoint}/${coordinateString}?${queryParamsString}`;

  console.log({ Uri });
  return Uri;
};

const orderFormat = async (orders) => {
  try {
    let formattedOrders = [
      {
        AWB: orders?.[0]?.orderId.AWB,
        address: orders?.[0]?.orderId.address,
        geocode: {
          longitude: orders?.[0]?.orderId.location.lng,
          latitude: orders?.[0]?.orderId.location.lat,
        },
        geojson: "",
      },
    ];

    const pairedOrders = [];

    for (let i = 0; i < orders.length - 1; i++) {
      pairedOrders.push([orders?.[i], orders?.[i + 1]]);
    }

    await Promise.all(
      pairedOrders.map(async (pair, i) => {
        try {
          const OSRMUri = generateOSRMUri(pair);
          const res = await axios.get(OSRMUri);
          const encodedPolyline = res?.data?.routes?.[0]?.geometry;
          console.log({ encodedPolyline });
          pair.push(encodedPolyline);
          // pair.push(OSRMUri);
        } catch (e) {
          console.error(e);
          console.log(i, i + 1);
        }
      })
    );

    const simPaths = pairedOrders.map((pair) => {
      return {
        AWB: pair[1].orderId.AWB,
        address: pair[1].orderId.address,
        geocode: {
          longitude: pair[1].orderId.location.lng,
          latitude: pair[1].orderId.location.lat,
        },
        geojson: pair[2],
      };
    });

    formattedOrders = formattedOrders.concat(simPaths);
    return formattedOrders;
  } catch (err) {
    throw err;
  }
};

module.exports = { createOutput };
