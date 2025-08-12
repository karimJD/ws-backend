import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import websocketService, { initializeWebSocket } from './routers/vr.js';
import { WebSocketServer } from 'ws';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
let wss;

// Middleware
app.use(helmet()); // Security headers
app.use(
  cors({
    origin: 'http://localhost:3000', // or use an array for multiple origins
    credentials: true,
  })
);
app.use(morgan('combined')); // Logging
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.get('/ws-health', (req, res) => {
  if (wss && wss.clients) {
    res.json({
      status: 'OK',
      clients: wss.clients.size,
      ready: true,
    });
  } else {
    res.status(500).json({
      status: 'WebSocket server not initialized',
      ready: false,
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.post('/api/game-state', (req, res) => {
  const { table, speed, gameStart } = req.body;
  try {
    if (table !== undefined) websocketService.sendTable(table);
    if (speed !== undefined) websocketService.sendSpeed(speed);
    if (gameStart !== undefined) websocketService.sendGameStart(gameStart);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start server
const startServer = async () => {
  // await connectDB();

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // Attach WebSocket server
  wss = new WebSocketServer({ server });
  initializeWebSocket(wss);
};

startServer();
