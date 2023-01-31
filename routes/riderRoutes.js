const router = require("express").Router();
const riderController = require("../controllers/riderController");

router.get("/:id", riderController.getRiderDetailsOfTheDay);
router.post("/:id/order-status/:orderID", riderController.markOrderStatus);

module.exports = router;
