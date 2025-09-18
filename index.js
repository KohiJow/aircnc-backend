require('dotenv').config(); 
// Load environment variables from .env file

const express = require('express'); 
// Express is a Node.js framework to create web servers and handle HTTP requests

const cors = require('cors'); 
// CORS allows your server to accept requests from different origins (browsers)

const path = require('path'); 
// Node.js module to handle file and directory paths

const mongoose = require('mongoose'); 
// Mongoose is an ODM (Object Data Modeling) library to interact with MongoDB using JS objects

const socketio = require('socket.io'); 
// Socket.io enables real-time, bidirectional communication between server and clients

const http = require('http'); 
// Built-in Node.js module to create HTTP servers

const routes = require('./routes'); 
// Import route definitions for the application

const app = express();

// Middleware
app.use(express.json()); // Parse JSON in all incoming requests
app.use(cors()); // Enable CORS for all routes

// Create HTTP server and attach Socket.io
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: 'http://localhost:5173', // Allow frontend requests (or '*' for any origin)
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const connectedUsers = {}; // Track connected users

// Socket.io connection
io.on('connection', socket => {
  console.log('User connected:', socket.id);

  // Get user ID from frontend query
  const { user_id } = socket.handshake.query;
  if (user_id) {
    if (!connectedUsers[user_id]) {
      connectedUsers[user_id] = [];
    }
    connectedUsers[user_id].push(socket.id);
    console.log(`User ${user_id} connected on socket ${socket.id}`);
  }

  // Example: send a welcome message
  // socket.emit('message', 'Welcome to AirCNC!');
  
  // Example: listen to messages from frontend
  // socket.on('message', data => console.log(data));
});

// Test route
app.get('/', (req, res) => res.send('API AirCNC loading...'));

// Middleware to make `io` and `connectedUsers` available in routes
app.use((req, res, next) => {
  req.io = io;
  req.connectedUsers = connectedUsers;
  next(); // Continue to the next middleware or route
});

// Load routes
app.use(routes);

// Serve uploaded files
app.use('/files', express.static(path.resolve(__dirname, 'uploads')));

// Simple ping route to test server
app.get('/ping', (req, res) => {
  console.log('Ping received');
  res.send('pong');
});

// Function to start MongoDB connection
async function startDatabase() {
  const { DB_USER, DB_PASS, DB_NAME, DB_CLUSTER1, DB_CLUSTER2 } = process.env;
  const uri = `my link from mongo db will be here//${DB_USER}:${DB_PASS}${DB_CLUSTER1}/${DB_NAME}?${DB_CLUSTER2}`;

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB Atlas');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1); // Stop the process if DB connection fails
  }
}

// Start server after DB connection
startDatabase().then(() => {
  const port = process.env.PORT || 3333;
  server.listen(port, () => {
    console.log(`Server started on port ${port}`);
  });
});
