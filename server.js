const express = require('express');
const cors = require('cors');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config();
// const serverless = require("serverless-http");

const app = express();
const PORT = process.env.PORT || 5000;

// MongoDB connection
let db;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = '90s-america';

// Function to create chat routes
function createChatRoutes() {
  // Get all chat messages
  app.get('/api/90s/chat', async (req, res) => {
    try {
      const collection = db.collection('memory_chat');
      const messages = await collection
        .find({})
        .sort({ timestamp: 1 })
        .toArray();
      
      res.json({ messages });
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      res.status(500).json({ error: 'Failed to fetch chat messages' });
    }
  });
  
  // Send a new chat message
  app.post('/api/90s/chat', async (req, res) => {
    try {
      const { message } = req.body;
      
      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message cannot be empty' });
      }
      
      const collection = db.collection('memory_chat');
      
      // Get total message count to generate username
      const totalMessages = await collection.countDocuments({});
      const username = `Anonymous${totalMessages + 1}`;
      
      const newMessage = {
        username,
        text: message.trim(),
        timestamp: new Date(),
        createdAt: new Date()
      };
      
      const result = await collection.insertOne(newMessage);
      
      // Get all messages including the new one
      const allMessages = await collection
        .find({})
        .sort({ timestamp: 1 })
        .toArray();
      
      res.json({ 
        success: true, 
        message: 'Message sent successfully',
        newMessage: { ...newMessage, _id: result.insertedId },
        allMessages
      });
    } catch (error) {
      console.error('Error sending chat message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });
}

// Function to create image routes
function createImageRoutes() {
  // Get all images
  app.get('/api/90s/images', async (req, res) => {
    try {
      const { page = 1, limit = 20, tag, search } = req.query;
      const skip = (page - 1) * limit;
      
      let filter = {};
      
      // Filter by tag
      if (tag) {
        filter.tags = { $in: [tag.toLowerCase()] };
      }
      
      // Search by filename
      if (search) {
        filter.filename = { $regex: search, $options: 'i' };
      }
      
      const collection = db.collection('images');
      const images = await collection
        .find(filter)
        .sort({ uploadDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .toArray();
      
      const total = await collection.countDocuments(filter);
      
      res.json({
        images,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching images:', error);
      res.status(500).json({ error: 'Failed to fetch images' });
    }
  });
  
  // Get image by ID (with base64 data)
  app.get('/api/90s/images/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const collection = db.collection('images');
      const image = await collection.findOne({ _id: id });
      
      if (!image) {
        return res.status(404).json({ error: 'Image not found' });
      }
      
      res.json(image);
    } catch (error) {
      console.error('Error fetching image:', error);
      res.status(500).json({ error: 'Failed to fetch image' });
    }
  });
  
  // Get random image
  app.get('/api/90s/images/random', async (req, res) => {
    try {
      const { tag } = req.query;
      const collection = db.collection('images');
      
      let filter = {};
      if (tag) {
        filter.tags = { $in: [tag.toLowerCase()] };
      }
      
      const image = await collection
        .aggregate([
          { $match: filter },
          { $sample: { size: 1 } }
        ])
        .toArray();
      
      if (image.length === 0) {
        return res.status(404).json({ error: 'No images found' });
      }
      
      res.json(image[0]);
    } catch (error) {
      console.error('Error fetching random image:', error);
      res.status(500).json({ error: 'Failed to fetch random image' });
    }
  });
  
  // Get image statistics
  app.get('/api/90s/images/stats', async (req, res) => {
    try {
      const collection = db.collection('images');
      
      const stats = await collection.aggregate([
        {
          $group: {
            _id: null,
            totalImages: { $sum: 1 },
            totalSize: { $sum: '$size' },
            avgSize: { $avg: '$size' }
          }
        }
      ]).toArray();
      
      const tagStats = await collection.aggregate([
        { $unwind: '$tags' },
        {
          $group: {
            _id: '$tags',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]).toArray();
      
      res.json({
        ...stats[0],
        topTags: tagStats
      });
    } catch (error) {
      console.error('Error fetching image stats:', error);
      res.status(500).json({ error: 'Failed to fetch image stats' });
    }
  });
  
  console.log('🖼️ Image API routes created');
}

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    if (MONGODB_URI) {
      const client = new MongoClient(MONGODB_URI);
      await client.connect();
      db = client.db(DB_NAME);
      console.log('✅ Connected to MongoDB Atlas');
      
      // Create image routes after successful connection
      createImageRoutes();
      
      // Create chat routes after successful connection
      createChatRoutes();
    } else {
      console.log('⚠️ MongoDB URI not provided - image features disabled');
    }
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
  }
}

// CORS configuration for production
const corsOptions = {
  origin: '*',
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 90s themed data
const ninetiesData = {
  movies: [
    { title: "Pulp Fiction", year: 1994, genre: "Crime" },
    { title: "The Matrix", year: 1999, genre: "Sci-Fi" },
    { title: "Titanic", year: 1997, genre: "Romance" },
    { title: "Jurassic Park", year: 1993, genre: "Adventure" },
    { title: "Forrest Gump", year: 1994, genre: "Drama" }
  ],
  music: [
    { artist: "Nirvana", song: "Smells Like Teen Spirit", year: 1991 },
    { artist: "Backstreet Boys", song: "I Want It That Way", year: 1999 },
    { artist: "Spice Girls", song: "Wannabe", year: 1996 },
    { artist: "TLC", song: "Waterfalls", year: 1994 },
    { artist: "Oasis", song: "Wonderwall", year: 1995 }
  ],
  trends: [
    "Tamagotchi",
    "Beanie Babies",
    "Pogs",
    "Slap Bracelets",
    "Fanny Packs",
    "Platform Shoes",
    "Choker Necklaces",
    "Crop Tops"
  ]
};

// Routes
app.get('/api/90s', (req, res) => {
  res.json({
    message: "Welcome to the 90s! 🎉",
    timestamp: new Date().toISOString(),
    data: ninetiesData
  });
});

app.get('/api/90s/movies', (req, res) => {
  res.json(ninetiesData.movies);
});

app.get('/api/90s/music', (req, res) => {
  res.json(ninetiesData.music);
});

app.get('/api/90s/trends', (req, res) => {
  res.json(ninetiesData.trends);
});

app.get('/api/90s/random', (req, res) => {
  const randomMovie = ninetiesData.movies[Math.floor(Math.random() * ninetiesData.movies.length)];
  const randomSong = ninetiesData.music[Math.floor(Math.random() * ninetiesData.music.length)];
  const randomTrend = ninetiesData.trends[Math.floor(Math.random() * ninetiesData.trends.length)];
  
  res.json({
    movie: randomMovie,
    song: randomSong,
    trend: randomTrend
  });
});

// Health check endpoint for deployment platforms
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    mongodb: db ? 'connected' : 'disconnected'
  });
});

// Serve React app in production (if serving from same domain)
if (process.env.NODE_ENV === 'production' && process.env.SERVE_FRONTEND === 'true') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

// Initialize MongoDB connection and start server
connectToMongoDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`🎵 Welcome to the 90s! 🌟`);
    console.log(`📺 Movies, Music, and Trends await you! 🎬🎤✨`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    if (db) {
      console.log(`🖼️ Image database: Connected`);
    } else {
      console.log(`🖼️ Image database: Disabled (no MongoDB URI)`);
    }
  });
});
