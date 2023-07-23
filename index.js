// Importing necessary modules and files
import express, { json, urlencoded } from "express";
import { sagedriverCompletion, test } from "./driverroutes.js";
import { corsMiddleware, rateLimitMiddleware } from "./middlewares.js";
import { DEBUG, SERVER_PORT, WEBDRIVERMODE } from "./config.js";
import { tunnel } from "cloudflared";

// Creating an instance of Express
let app = express();

// Handling uncaught exceptions in debug mode
process.on("uncaughtException", function (err) {
  if (DEBUG) console.error(`Caught exception: ${err}`);
});

// Applying middlewares
app.use(corsMiddleware); // Enabling CORS
app.use(rateLimitMiddleware); // Applying rate limiting for requests
app.use(json()); // Parsing incoming JSON data
app.use(urlencoded({ extended: true })); // Parsing URL-encoded data with extended options

// Registering routes
app.all("/", async function (req, res) {
  // Default route to return basic information
  res.set("Content-Type", "application/json");
  return res.status(200).send({
    status: true,
    github: "https://github.com/4e4f4148/JanitorAI-POE-Proxy",
    discord: "https://discord.com/channels/563783473115168788/1129375417673977867",
  });
});

// Setting up a tunnel and getting the proxy URL
const { url, connections, child, stop } = tunnel({
  "--url": `localhost:${SERVER_PORT}`,
});
let baselink = await url;

// Logging the Sage driver proxy URL if in web driver mode
if (WEBDRIVERMODE) console.log(`Sage driver proxy URL: ${baselink}/v2/driver/sage`);

// Assigning route handlers
app.post("/v2/driver/sage/chat/completions", sagedriverCompletion);
app.post("/test", test);

app.get("/v2/driver/sage/", async function (req, res) {
  // Endpoint to get information about the Sage driver
  res.set("Content-Type", "application/json");
  return res.status(200).send({
    status: true,
    port: SERVER_PORT,
  });
});

app.get("/v2/driver/sage/models", async function (req, res) {
  // Endpoint to get information about Sage models
  console.log(req); // Logging the request object
  res.set("Content-Type", "application/json");
  return res.status(200).send({
    "object": "list",
    "data": [
      // List of model data objects
      {
        "id": "babbage",
        "object": "model",
        "created": 1649358449,
        // More model details...
      },
      {
        "id": "text-davinci-003",
        "object": "model",
        "created": 1669599635,
        // More model details...
      },
    ],
  });
});

app.get("/api/completions", async function (req, res) {
  // Endpoint to get completion data
  console.log(req); // Logging the request object
  res.set("Content-Type", "application/json");
  return res.status(200).send({
    "data": [
      // List of completion data objects
      { "id": 3 },
      { "id": 1 },
      { "id": 5 },
      { "id": 2 },
      { "id": 4 },
    ],
  });
});

// Logging URLs and starting the server
console.log(`Sage driver: http://localhost:${SERVER_PORT}/v2/driver/sage`);
console.log(`Proxy is running on PORT ${SERVER_PORT} ...`);

// Starting the server
app.listen(SERVER_PORT, () => {
  console.log(`LOCAL URL: http://localhost:${SERVER_PORT}/v2/driver/sage`);
});
