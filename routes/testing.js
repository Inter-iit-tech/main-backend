const router = require("express").Router();
const testingController = require("../controllers/high-testing");

router.post("/testing", testingController.startOfTheDayCall);
router.post("/len", testingController.getLengths);

module.exports = router;
