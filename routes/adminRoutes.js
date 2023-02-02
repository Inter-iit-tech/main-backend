const router = require("express").Router();
const adminController = require("../controllers/adminController");
const notificationController = require("./../controllers/notificationController");

router.get("/details", adminController.adminDetails);
router.post("/add-pickup", adminController.addPickup);
router.post("/notification", notificationController.sendNotification);

module.exports = router;
