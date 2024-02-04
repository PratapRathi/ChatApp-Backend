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
const FriendRequest = require("./models/friendRequest");
const { send } = require("process");
const server = http.createServer(app);  // Using Node 'http' module in place of Express for creating server

// Creating instance of socket.io with http server
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
})

const port = process.env.PORT || 8000;
server.listen(port, () => {
    console.log("App is running on port " + port);
});

io.on("connection", async (socket) => {
    console.log(JSON.stringify(socket.handshake.query));
    // console.log(socket);
    const user_id = socket.handshake.query["user_id"];
    const socket_id = socket.id;
    console.log("user connected", socket_id)
    if (Boolean(user_id)) {
        await User.findByIdAndUpdate(user_id, {})
    }

    // we can write our socket events here

    socket.on("friend_request", async (data) => {
        console.log(data.to);  // here "to" is the id of recipient

        // data => {to, from}
        const to = User.findById(data.to).select("socket_id");
        const from = User.findById(data.from).select("socket_id");

        // TODO => create a friend request
        await FriendRequest.create({
            sender: data.from,
            recipient: data.to
        })

        // Emit event => "new_friend_request"
        io.to(to.socket_id).emit("new_friend_request", {
            message: "New Friend Request Received"
        })
        // Emit event => "request_sent"
        io.to(from.socket_id).emit("request_sent", {
            message: "Request Sent Successfully"
        })
    })

    socket.on("accep_request", async (data) => {
        console.log(data);
        // request_id
        const request_doc = await FriendRequest.findById(data.request_id);
        console.log(request_doc);

        // Sender and Receiver dov from DB
        const sender = await User.findById(request_doc.sender);
        const receiver = await User.findById(request_doc.recipient);

        // Adding both users into their friends array in DB
        sender.friends.push(request_doc.recipient);
        receiver.friends.push(request_doc.sender);
        await sender.save({ new: true, validateModifiedOnly: true });
        await receiver.save({ new: true, validateModifiedOnly: true });

        // Delete Friend-request after accepting
        await FriendRequest.findByIdAndDelete(data.request_id);

        // Sending notification to front-end
        io.to(sender.socket_id).emit("request_accepted", {
            message: "Friend Request Accepted Successfully!"
        });
        io.to(receiver.socket_id).emit("request_accepted", {
            message: "Friend Request Accepted Successfully!"
        });
    })

    socket.on("end", function(){
        console.log("Closing connection");
        socket.disconnect(0);
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