const express = require("express");  // Web Framework for Node.js
const routes = require("./routes/index"); // Routes for the API calls
const morgan = require("morgan");  // HTTP request logger middleware for node.js
const dotenv = require("dotenv"); // Package to access Environment Variables
dotenv.config({path: "./config.env"});

const rateLimit = require("express-rate-limit");  // Basic rate-limiting middleware for Express
const helmet = require("helmet");  // Helmet helps secure Express apps by setting HTTP response headers.
const mongosanitize = require("express-mongo-sanitize");  // sanitizes user-supplied data to prevent MongoDB Operator Injection 
const bodyParser = require("body-parser");  // Parse incoming request bodies in a middleware before handlers, available under the req.body property
const xss = require("xss");  // Module used to filter input from users to prevent XSS attacks
const cors = require("cors"); // 


const app = express();

// Using Middlewares
app.use(express.urlencoded({extended: true}));
app.use(mongosanitize());

// app.use(xss());

app.use(cors({
    origin: "*",
    methods: ["GET", "PATCH", "POST", "DELETE", "PUT"],
    credentials: true,
}));
app.use(express.json({limit: "10kb"}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(helmet());
if(process.env.NODE_ENV === "development"){
    app.use(morgan("dev"));
}
const limiter = rateLimit({
    max: 3000,
    windowMs: 60 * 60 * 1000,  // In one hour,
    message: "Too many requests from this IP, Please try again in an hour",
})
app.use("/", limiter);

app.use(routes);

module.exports = app;