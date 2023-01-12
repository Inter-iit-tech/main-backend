require("dotenv").config();

const { Client } = require("@googlemaps/google-maps-services-js");
const express = require("express");

const PORT = process.env.PORT || 3000;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const client = new Client({});

const getGeoCode = async (address) => {
  try {
    const args = {
      params: {
        key: GOOGLE_MAPS_API_KEY,
        address: address,
        region: "IN",
      },
    };
    const gcResponse = await client.geocode(args);
    console.log(
      `${gcResponse.data.results[0].formatted_address} - ${gcResponse.data.results[0].geometry.location.lat},${gcResponse.data.results[0].geometry.location.lng}`
    );
    return gcResponse.data;
  } catch (e) {
    throw e;
  }
};

const app = express();

app.use(express.json({ limit: "10kb" }));

app.get("/api/geocode", async (req, res) => {
  try {
    const address = req.body.address;
    const response = await getGeoCode(address);
    res.json(response);
  } catch (e) {
    res.json({ status: "400", message: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on PORT ${PORT}`);
});
