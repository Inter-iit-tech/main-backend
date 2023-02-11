const Rider = require("../model/riderModel");

const { ORDER_ALLOCATION_SERVER_URL, DEPOT_SKU } = require("../utils/config");

const baseUrl = ORDER_ALLOCATION_SERVER_URL;

const transformTimingToSeconds = (timeString) => {
  const spl = timeString.split(":");
  let seconds = 0;
  seconds =
    seconds +
    parseInt(spl[0]) * 60 * 60 +
    parseInt(spl[1]) * 60 +
    parseInt(spl[2]);
  return seconds;
};

const simulateForDuration = async (timeDuration) => {
  const riders = await Rider.find();

  await Promise.all(
    riders.map(async (rider) => {
      let timeElapsed = 0;
      let noOfOrdersRemoved = 0;
      let tours = rider.tours;

      let headingTo = "";

      for (let tour of tours) {
        for (let order of tour) {
          if (!(order.timing === "09:00:00")) {
            if (timeElapsed <= timeDuration) {
              const timing = transformTimingToSeconds(order.timing);
              if (timeElapsed + timing <= timeDuration) {
                timeElapsed += timing;
                noOfOrdersRemoved++;
              } else {
                console.log({ orderIn: order });
                headingTo = order.orderId._id;
                break;
              }
            }
          } else {
            noOfOrdersRemoved++;
          }
        }

        if (noOfOrdersRemoved >= tour.length) {
          tours.splice(0, 1);
        }
      }
      rider.headingTo = headingTo;
      rider.tours = tours;
      console.log({ riderID: rider._id, noOfOrdersRemoved, headingTo });
      await rider.save();
    })
  );
};

const simulateForFirstHour = async (req, res, next) => {
  const noOfHours = req.body.hours;
  await simulateForDuration(noOfHours * 60 * 60);
  const riders = await Rider.find();
  res.status(200).json({ data: riders });
};

module.exports = { simulateForFirstHour };
