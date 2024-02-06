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
const path = require("path");
const OneToOneMessage = require("./models/OneToOneMessage");
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


// WebSocket Instance
io.on("connection", async (socket) => {
    console.log("user connected", JSON.stringify(socket.handshake.query));
    // console.log(socket);
    const user_id = socket.handshake.query["user_id"];
    const socket_id = socket.id;
    if (Boolean(user_id)) {
        await User.findByIdAndUpdate(user_id, { socket_id, status: "Online" })
    }

    // we can write our socket events here
    socket.on("friend_request", async (data) => {
        // here "to" is the id of recipient
        // data => {to, from}
        const to = await User.findById(data.to).select("socket_id");
        const from = await User.findById(data.from).select("socket_id");

        //  create a friend request
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
            message: "Friend Request Sent Successfully"
        })
    })

    socket.on("accept_request", async (data) => {
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

    socket.on("get_direct_conversations", async ({ user_id }, callback) => {
        const existing_conversation = await OneToOneMessage.find({
            participants: { $all: [user_id] }
        }).populate("participants", "firstName lastName _id email status");
        callback(existing_conversation);
    });

    socket.on("start_conversation", async (data) => {
        // data => {to,from}
        const { to, from } = data;
        // Check if there is any existing conversation between these 2 users
        const existing_conversation = await OneToOneMessage.find({
            participants: { $size: 2, $all: [to, from] }
        }).populate("participants", "firstName lastName _id email status");
        
        // If there is no existing_conversation
        if(existing_conversation.length === 0){
            let new_chat = await OneToOneMessage.create({
                participants:[to, from]
            })
            new_chat = await OneToOneMessage.findById(new_chat._id).populate("participants", "firstName lastName _id email status");
            console.log(new_chat);
            socket.emit("start_chat", new_chat);
        }
        // If there is existing_conversation
        else{
            socket.emit("start_chat", existing_conversation[0]);
        }

    });


    //
    socket.on("get_messages", async(data,callback) => {
        const messages = await OneToOneMessage.findById(data.conversation_id).select("messages");
        callback(messages);
    })


    // Handle Text/Link messages
    socket.on("text_message", async(data) => {

        // data = {to, from, message, conversation_id }
        const {to, from, message, conversation_id } = data;

        const to_user = await User.findById(to);
        const from_user = await User.findById(from);

        const new_message = {to, from, type:"text", text:message, created_at: Date.now()};

        // Create a new conversation if it does'nt exist already or add a new message to the message array
        const chat = await OneToOneMessage.findById(conversation_id);
        chat.messages.push(new_message);
        // save to DB
        await chat.save({});

        // emit incoming_message -> to user
        io.to(to_user.socket_id).emit("new_text_message", {
            conversation_id,
            message: new_message
        })
        // emit outgoing_message -> from user
        io.to(from_user.socket_id).emit("new_text_message", {
            conversation_id,
            message: new_message
        })
    })

    socket.on("file_message", (data) => {
        console.log("Received message:- ", data)

        // data = {"to", "from", "text", "file"}

        // get the file extension
        const fileExtension = path.extname(data.file.name);

        // generate a unique file-name
        const fileName = `${Date.now()}_${Math.floor(Math.random() * 10000)}${fileExtension}`

        // Upload file to AWS S3

        // Create a new conversation if it does'nt exist already or add a new message to the message array

        // save to DB

        // emit incoming_message -> to user

        // emit outgoing_message -> from user
    })

    socket.on("end", async (data) => {
        // Find user by ID and set status to offline
        if (data.user_id) {
            await User.findByIdAndUpdate(data.user_id, { status: "Offline" })
        }
        // TODO => Broadcast user is disconnected

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