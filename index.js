const http = require("http");

const app = require("./app");

const { PORT } = require("./utils/config");
const server = http.createServer(app);

console.log("Starting app..");

server.listen(PORT, () => {
  console.log(`Server is running on PORT ${PORT}`);
});
