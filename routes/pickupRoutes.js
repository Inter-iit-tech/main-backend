const router = require("express").Router();
const pickupController = require("../controllers/pickupController");
const simulationController = require("../controllers/simulationController");

router.post("/in-pickup", pickupController.inputPickupDetails);
router.post("/add-pickup", pickupController.callAddPickupFunction);
router.post("/simulate", simulationController.simulateForFirstHour);

module.exports = router;
