const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const xss = require("xss-clean");
const fileUpload = require("express-fileupload");

const middleware = require("./utils/middleware");
const AppError = require("./utils/appError");

const globalErrorHandler = require("./controllers/errorController");

const inputRouter = require("./routes/inputRoutes");
const adminRouter = require("./routes/adminRoutes");
const riderRouter = require("./routes/riderRoutes");
const pickupRouter = require("./routes/pickupRoutes");
const outputRouter = require("./routes/outputRoutes");
const testRouter = require("./routes/testing");

const app = express();

app.use(helmet());
app.use(xss());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({ useTempFiles: true, tempFileDir: "/tmp/" }));

app.use(middleware.requestLogger);

app.get("/api/health", (req, res, next) => {
  res.send("Health Check is working fine!");
});

//Input Endpoint
app.use("/api/v1/input", inputRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/rider", riderRouter);
app.use("/api/v1/pickup", pickupRouter);
app.use("/api/v1/output", outputRouter);
app.use("/api/v1/test", testRouter);

app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
