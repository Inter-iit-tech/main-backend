const http = require("http");
const mongoose = require("mongoose");

const app = require("./app");
const { PORT, MONGODB_URI } = require("./utils/config");

const server = http.createServer(app);

console.log("Starting app..");
console.log("MONGODB_URI: ", MONGODB_URI);
console.log("Waiting for connection to MongoDB");

mongoose.set("strictQuery", false);
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB!");
    console.log("Starting webserver..");
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((e) => {
    console.log(
      `Error: ${e.message}\n Could not connect to MongoDB server! Shutting down...`
    );
    process.exit(1);
  });
