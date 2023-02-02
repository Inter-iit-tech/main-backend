const router = require("express").Router();
const inputController = require("../controllers/inputController");

router.post("/deliveryPoints", inputController.inputDeliveryPoints);
router.post("/productDetails", inputController.inputProductDetails);
router.post("/dummyProductDetails", inputController.inputDummyProducts);
router.post("/riderDetails", inputController.inputRiderDetails);
router.post("/depot", inputController.inputDepotLocation);

module.exports = router;
