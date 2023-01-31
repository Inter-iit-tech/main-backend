const router = require("express").Router();
const adminController = require("../controllers/adminController");

router.get("/details", adminController.adminDetails);
router.post("/add-pickup", adminController.addPickup);

module.exports = router;
