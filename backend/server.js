const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');
const http = require('http');
const socketIo = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);


// Set up socket.io with CORS configuration
const io = socketIo(server, {
    cors: {
      origin: 'http://localhost:5173', // Allow your frontend origin
      methods: ['GET', 'POST'],
    }
  });

app.use(cors({
    origin: 'http://localhost:5173/',
}));

app.use(bodyParser.json());

const openai = new OpenAI({
    apiKey: process.env.API_KEY,
});

// Create MySQL connection pool
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'text_to_image',
});

// Create the messages table if it doesn't exist
const createTableQuery = `
    CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_message TEXT NOT NULL,
        bot_response TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

db.query(createTableQuery, (err, result) => {
    if (err) {
        console.error("Error creating table:", err);
    } else {
        console.log("Messages table checked/created successfully");
    }
});

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

            // Store the user message and bot response in MySQL
            const query = 'INSERT INTO messages (user_message, bot_response) VALUES (?, ?)';
            db.query(query, [prompt, botResponse], (err, result) => {
                if (err) {
                    console.error("Error saving message:", err);
                    socket.emit('error', { error: "Failed to store message" });
                } else {
                    // Emit the generated response to the client in real-time
                    socket.emit('receiveMessage', {
                        user_message: prompt,
                        bot_response: botResponse,
                    });
                }
            });

        } catch (error) {
            console.error("Error generating:", error);
            socket.emit('error', { error: "Failed to generate response" });
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Endpoint to fetch messages datewise
app.get("/api/messages/:date", (req, res) => {
    const { date } = req.params;  // Expecting the date in 'YYYY-MM-DD' format

    const query = 'SELECT * FROM messages WHERE DATE(created_at) = ?';
    db.query(query, [date], (err, results) => {
        if (err) {
            console.error("Error fetching messages:", err);
            return res.status(500).json({ error: "Failed to fetch messages" });
        }

        return res.status(200).json({
            message: "Messages fetched successfully",
            data: results,
        });
    });
});



// Start server
server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
