const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();
const bodyParser = require('body-parser');

const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: "*",
  credentials: true
}));

app.use(bodyParser.json({ 
  limit: '100mb'
}));

app.use(bodyParser.urlencoded({ 
  limit: '100mb',
  extended: true
}));

app.use((req, res, next) => {
  if (req.path === '/api/posts' && req.method === 'POST') {
    console.log('POST /api/posts received');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Content-Length:', req.headers['content-length']);
    console.log('Body keys:', Object.keys(req.body));
    console.log('Image data length:', req.body.image ? req.body.image.length : 'No image');
  }
  next();
});

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB Atlas'))
.catch((error) => console.error('MongoDB connection error:', error));

app.use('/api', authRoutes);
app.use('/api', postRoutes(io));

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });

  socket.on('joinRoom', (platform) => {
    const rooms = Array.from(socket.rooms);
    rooms.forEach(room => {
      if (room !== socket.id) {
        socket.leave(room);
      }
    });
    
    socket.join(platform);
    console.log(`Socket ${socket.id} joined ${platform} room`);
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    message: 'Server is running', 
    timestamp: new Date().toISOString(),
    connectedClients: io.engine.clientsCount,
    maxPayloadSize: '50MB'
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Socket.IO server ready');
  console.log('Max payload size: 50MB for base64 images');
});