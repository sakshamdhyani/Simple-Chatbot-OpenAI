import React, { useState, useEffect } from 'react';
import './App.css';
import { io } from 'socket.io-client';

// Socket.io client connection
const socket = io('http://localhost:3000'); // Update the URL if necessary

function App() {
  const [userMessage, setUserMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Loading state for showing "typing" indicator

  useEffect(() => {
    // Listen for real-time messages from the server
    socket.on('receiveMessage', (data) => {
      setChatMessages((prevMessages) => [
        ...prevMessages,
        { user_message: data.user_message, bot_response: data.bot_response },
      ]);
      setIsLoading(false); // Stop loading when response is received
    });

    // Listen for errors from the server
    socket.on('error', (data) => {
      setErrorMessage(data.error);
      setIsLoading(false); // Stop loading on error
    });

    return () => {
      socket.off('receiveMessage');
      socket.off('error');
    };
  }, []);

  const handleMessageSend = () => {
    if (userMessage.trim()) {
      setIsLoading(true); // Start loading when message is sent
      // Send message to the backend using Socket.io
      socket.emit('sendMessage', userMessage);
      setUserMessage('');
    }
  };

  return (
    <div className="App">
      <h1>Chat with Bot</h1>

      {/* Display chat messages */}
      <div className="chat-box">
        {chatMessages.map((msg, index) => (
          <div key={index} className="chat-message">
            <p className="user-message"><strong>You:</strong> {msg.user_message}</p>
            <p className="bot-message"><strong>Bot:</strong> {msg.bot_response}</p>
          </div>
        ))}
      </div>

      {/* Error Message */}
      {errorMessage && <div className="error-message">{errorMessage}</div>}

      {/* Show loading animation while waiting for the bot response */}
      {isLoading && <div className="typing-indicator">Bot is typing...</div>}

      {/* Message input field */}
      <div className="input-container">
        <input
          type="text"
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          placeholder="Type your message..."
        />
        <button onClick={handleMessageSend}>Send</button>
      </div>
    </div>
  );
}

export default App;
