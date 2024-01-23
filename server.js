const app = require("./app");
const mongoose = require('mongoose');
const dotenv = require("dotenv");
dotenv.config({path: "./config.env"});



const DB = process.env.MONGO_URI;
mongoose.connect(DB).then((con)=>{
    console.log("MongoDB is connected successfully")
}).catch((err)=>{
    console.log(err);
})


process.on("uncaughtException", (err)=>{
    console.log(err);
    process.exit(1);
})

const http = require("http");  
const server = http.createServer(app);  // Using Node 'http' module in place of Express for creating server

const port = process.env.PORT || 8000;
app.listen(port, ()=>{
    console.log("App is running on port "+ port);
});

process.on("unhandledRejection", (err)=>{
    console.log(err);
    server.close(()=>{
        process.exit(1);
    })
})