const app = require("./app"); // app that contain all middleware and routes as its children
const mongoose = require('mongoose'); // mongoose ORM to connect with mongoDB
const dotenv = require("dotenv");  // dotenv package to read our environment variables
dotenv.config({ path: "./config.env" });  // path to .env file
const { Server } = require("socket.io");
const User = require("./models/user");


// Creating connection to MongoDB
const DB = process.env.MONGO_URI;
mongoose.connect(DB).then((res) => {
    console.log("MongoDB is connected successfully")
}).catch((err) => {
    console.log(err);
})

process.on("uncaughtException", (err) => {
    console.log(err);
    process.exit(1);
})

// using built-in HTTP server instead of Express-server to get more control over it
const http = require("http");
const server = http.createServer(app);  // Using Node 'http' module in place of Express for creating server

// Creating instance of socket.io with http server
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000/",
        methods: ["GET", "POST"]
    }
})

const port = process.env.PORT || 8000;
server.listen(port, () => {
    console.log("App is running on port " + port);
});

io.on("connection", async(socket)=>{
    // console.log(socket);
    const user_id = socket.handshake.query["user_id"];
    const socket_id = socket.id;
    console.log("user connected", socket_id)
    if(user_id){
        await User.findByIdAndUpdate(user_id, {})
    }

    // we can write our socket events here
    socket.on("friend_request", async(data)=>{
        console.log(data.to);  // here "to" is the id of recipient

        const to = User.findById(data.to);

        // TODO => create a friend request

        io.to(to.socket_id).emit("new_friend_request", {

        })

    })
})






// If any promise rejection is unhandled in our code it will close/restart our server
process.on("unhandledRejection", (err) => {
    console.log(err);
    server.close(() => {
        process.exit(1);
    })
    // setTimeout(() => {
    //     server.listen(port, () => {
    //         console.log("App is running on port " + port);
    //     });
    // }, 2000)
})