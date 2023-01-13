const router = require("express").Router();
const inputController = require("../controllers/inputController");

router.post("/deliveryPoints", inputController.inputDeliveryPoints);

module.exports = router;
