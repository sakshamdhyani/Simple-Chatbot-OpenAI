const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Set up socket.io with CORS configuration
const io = socketIo(server, {
    cors: {
        origin: '/',
        methods: ['GET', 'POST'],
    },
});

app.use(bodyParser.json());

const openai = new OpenAI({
    apiKey: process.env.API_KEY,
});

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch((err) => console.error('Error connecting to MongoDB:', err));

// Define message schema and model
const messageSchema = new mongoose.Schema({
    user_message: { type: String, required: true },
    bot_response: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
});

const Message = mongoose.model('Message', messageSchema);

// Handle real-time communication via socket
io.on('connection', (socket) => {
    console.log('A user connected');

    // Handle chat message sent by the user
    socket.on('sendMessage', async (prompt) => {
        if (!prompt) {
            socket.emit('error', { error: "Prompt is required" });
            return;
        }

        try {
            // Generate response from OpenAI
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",  // Correct model name
                messages: [
                    { role: "user", content: prompt },
                ],
            });

            const botResponse = completion.choices[0].message.content;  // Bot's response

            // Save the user message and bot response to MongoDB
            const message = new Message({
                user_message: prompt,
                bot_response: botResponse,
            });

            await message.save();

            // Emit the generated response to the client in real-time
            socket.emit('receiveMessage', {
                user_message: prompt,
                bot_response: botResponse,
            });
        } catch (error) {
            console.error("Error generating response:", error);
            socket.emit('error', { error: "Failed to generate response" });
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Endpoint to fetch messages datewise
app.get("/api/messages/:date", async (req, res) => {
    const { date } = req.params;  // Expecting the date in 'YYYY-MM-DD' format

    try {
        const messages = await Message.find({
            created_at: {
                $gte: new Date(date),
                $lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1)),
            },
        });

        res.status(200).json({
            message: "Messages fetched successfully",
            data: messages,
        });
    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ error: "Failed to fetch messages" });
    }
});

const NODE_ENV = "production";

// Serve frontend
if (NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "./dist")));

    app.get("*", (req, res) =>
        res.sendFile(
            path.resolve(__dirname, "./", "dist", "index.html")
        )
    );
} else {
    app.get("/", (req, res) => res.send("Please set to production"));
}

// Start server
server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
