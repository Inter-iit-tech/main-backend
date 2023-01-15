const router = require("express").Router();
const inputController = require("../controllers/inputController");

router.post("/deliveryPoints", inputController.inputDeliveryPoints);
router.post("/productDetails", inputController.inputProductDetails);

module.exports = router;
