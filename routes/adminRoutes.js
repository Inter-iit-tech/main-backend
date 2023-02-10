const router = require("express").Router();
const adminController = require("../controllers/adminController");
const notificationController = require("./../controllers/notificationController");

router.get("/details", adminController.adminDetails);
router.get("/details-db/:reqQuery", adminController.getDetails);
router.post("/add-pickup", adminController.addPickup);
router.post("/del-pickup", adminController.deletePickup);
router.post("/notification", notificationController.sendNotification);
router.post("/clear-pickup", adminController.clearPickups);
router.get("/rider-admin", adminController.getRiderDetailsForAdmin);

module.exports = router;
