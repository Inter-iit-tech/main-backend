const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const xss = require("xss-clean");
const fileUpload = require("express-fileupload");

const middleware = require("./utils/middleware");
const AppError = require("./utils/appError");
const globalErrorHandler = require("./controllers/errorController");
const inputRouter = require("./routes/inputRoutes");

const app = express();

app.use(helmet());
app.use(xss());
app.use(cors({ origin: "http://localhost:3001", credentials: true }));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({ useTempFiles: true, tempFileDir: "/tmp/" }));

app.use(middleware.requestLogger);

//Input Endpoint
app.use("/api/v1/input", inputRouter);

app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
