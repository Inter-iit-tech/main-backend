const router = require("express").Router();
const notificationController = require("./../controllers/notificationController");

router.post("/notification", notificationController.sendNotification);
module.exports = router;
