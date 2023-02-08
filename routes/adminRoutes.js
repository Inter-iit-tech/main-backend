const router = require("express").Router();
const adminController = require("../controllers/adminController");
const notificationController = require("./../controllers/notificationController");

router.get("/details", adminController.adminDetails);
router.get("/details-db/:reqQuery", adminController.getDetails);
router.post("/add-pickup", adminController.addPickup);
router.post("/in-pickup", adminController.inputPickupDetails);
router.post("/del-pickup", adminController.deletePickup);
router.post("/notification", notificationController.sendNotification);
router.post("/demo", adminController.simulateForFirstHour);
router.post("/demo-demo", adminController.demo);
router.get("/rider-admin", adminController.getRiderDetailsForAdmin);

module.exports = router;
