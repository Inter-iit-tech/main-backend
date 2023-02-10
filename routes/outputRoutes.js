const router = require("express").Router();
const outputController = require("../controllers/outputController");

router.get("/", outputController.createOutput);


module.exports = router;
