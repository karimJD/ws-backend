// routers/vr.js - Updated to handle client messages + new data types
import { WebSocket } from 'ws';

class WebSocketService {
  constructor() {
    this.clients = new Map();
    this.subscriptions = new Map(); // clientId -> Set of subscriptions
  }

  // Send table value to all clients
  sendTable(table) {
    const data = {
      type: 'table_update',
      table,
      timestamp: new Date().toISOString(),
    };
    return this.broadcast(data);
  }

  // Send speed value to all clients
  sendSpeed(speed) {
    if (typeof speed !== 'number' || speed < 0.2 || speed > 1) {
      throw new Error('Speed must be a number between 0.2 and 1');
    }
    const data = {
      type: 'speed_update',
      speed,
      timestamp: new Date().toISOString(),
    };
    return this.broadcast(data);
  }

  sendGameStart(gameStart) {
    const data = {
      type: 'game_start_update',
      gameStart,
      timestamp: new Date().toISOString(),
    };
    return this.broadcast(data);
  }

  // NEW: Send products data to all clients
  sendProducts(generatedProductType) {
    const data = {
      type: 'products_update',
      generatedProductType,
      timestamp: new Date().toISOString(),
    };
    return this.broadcast(data);
  }

  // NEW: Send sorted objects count to all clients
  sendSortedObjects(sortedObjectType) {
    // if (typeof count !== 'number' || count < 0) {
    //   throw new Error('Sorted objects count must be a non-negative number');
    // }
    const data = {
      type: 'sorted_objects_update',
      sortedObjectType,
      timestamp: new Date().toISOString(),
    };
    return this.broadcast(data);
  }

  // NEW: Send unsorted objects count to all clients
  sendUnsortedObjects(unsortedObjectType) {
    // if (typeof count !== 'number' || count < 0) {
    //   throw new Error('Unsorted objects count must be a non-negative number');
    // }
    const data = {
      type: 'unsorted_objects_update',
      unsortedObjectType,
      timestamp: new Date().toISOString(),
    };
    return this.broadcast(data);
  }

  // NEW: Send errors count to all clients
  sendErrors(count) {
    if (typeof count !== 'number' || count < 0) {
      throw new Error('Errors count must be a non-negative number');
    }
    const data = {
      type: 'errors_update',
      count,
      timestamp: new Date().toISOString(),
    };
    return this.broadcast(data);
  }

  sendPickUpFromZone(zone) {
    const validZones = ['red', 'green', 'yellow'];
    if (!validZones.includes(zone.toLowerCase())) {
      throw new Error('Zone must be one of: red, green, yellow');
    }
    const data = {
      type: 'pickup_zone_update',
      zone: zone.toLowerCase(),
      timestamp: new Date().toISOString(),
    };
    return this.broadcast(data);
  }

  initialize(wss) {
    this.wss = wss;

    wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();

      // Store client connection
      this.clients.set(clientId, {
        ws,
        subscriptions: new Set(),
        connectedAt: new Date(),
        ip: req.socket.remoteAddress,
      });

      console.log(
        `WebSocket client ${clientId} connected from ${req.socket.remoteAddress}`
      );

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connection',
        message: 'Connected to VR Game Dashboard',
        clientId: clientId,
        timestamp: new Date().toISOString(),
      });

      // Handle incoming messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(clientId, message);
        } catch (error) {
          console.error(
            `Error parsing message from client ${clientId}:`,
            error
          );
          this.sendToClient(clientId, {
            type: 'error',
            message: 'Invalid JSON format',
          });
        }
      });

      // Handle client disconnect
      ws.on('close', (code, reason) => {
        console.log(
          `Client ${clientId} disconnected. Code: ${code}, Reason: ${reason}`
        );
        this.clients.delete(clientId);
        this.subscriptions.delete(clientId);
      });

      // Handle WebSocket errors
      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
      });
    });
  }

  handleClientMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    console.log(`Received message from client ${clientId}:`, message);

    switch (message.type) {
      case 'subscribe':
        this.handleSubscription(clientId, message.data);
        break;
      case 'unsubscribe':
        this.handleUnsubscription(clientId, message.data);
        break;
      case 'ping':
        this.sendToClient(clientId, {
          type: 'pong',
          timestamp: new Date().toISOString(),
        });
        break;

      // Handle game state updates from React app
      case 'speed_update':
        this.handleSpeedUpdate(clientId, message);
        break;
      case 'debit_update':
        this.handleTableUpdate(clientId, message);
        break;
      case 'game_start_update':
        this.handleGameStartUpdate(clientId, message);
        break;
      case 'zones_toggle_update':
        this.handleZonesToggleUpdate(clientId, message);
        break;

      // NEW: Handle new data type updates from React app
      case 'products_update':
        this.handleProductsUpdate(clientId, message);
        break;
      case 'sorted_objects_update':
        this.handleSortedObjectsUpdate(clientId, message);
        break;
      case 'unsorted_objects_update':
        this.handleUnsortedObjectsUpdate(clientId, message);
        break;
      case 'errors_update':
        this.handleErrorsUpdate(clientId, message);
        break;
      case 'pickup_zone_update':
        this.handlePickUpFromZone(clientId, message);
        break;

      default:
        console.log(
          `Unknown message type from client ${clientId}:`,
          message.type
        );
        this.sendToClient(clientId, {
          type: 'error',
          message: `Unknown message type: ${message.type}`,
        });
    }
  }

  // Handle speed updates from React app
  handleSpeedUpdate(clientId, message) {
    try {
      const { speed } = message;
      if (typeof speed !== 'number' || speed < 0.2 || speed > 1) {
        throw new Error('Speed must be a number between 0.2 and 1');
      }

      console.log(`Speed update from client ${clientId}: ${speed}`);

      // Broadcast to all other clients (excluding sender)
      const data = {
        type: 'speed_update',
        speed,
        timestamp: new Date().toISOString(),
        source: clientId,
      };

      this.broadcastExcluding(clientId, data);

      // Send confirmation to sender
      this.sendToClient(clientId, {
        type: 'speed_update_confirmed',
        speed,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'error',
        message: error.message,
      });
    }
  }

  // Handle table updates from React app
  handleTableUpdate(clientId, message) {
    try {
      const { debit } = message;
      console.log(`Table debit update from client ${clientId}: ${debit}`);

      // Broadcast to all other clients (excluding sender)
      const data = {
        type: 'debit_update',
        debit,
        timestamp: new Date().toISOString(),
        source: clientId,
      };

      this.broadcastExcluding(clientId, data);

      // Send confirmation to sender
      this.sendToClient(clientId, {
        type: 'debit_update_confirmed',
        debit,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'error',
        message: error.message,
      });
    }
  }

  handleGameStartUpdate(clientId, message) {
    try {
      const { isGameStarted } = message;

      console.log(
        `Game start update from client ${clientId}: ${isGameStarted}`
      );

      // Broadcast to all other clients (excluding sender)
      const data = {
        type: 'game_start_update',
        isGameStarted,
        timestamp: new Date().toISOString(),
        source: clientId,
      };

      this.broadcastExcluding(clientId, data);

      // Send confirmation to sender
      this.sendToClient(clientId, {
        type: 'game_start_update_confirmed',
        isGameStarted,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'error',
        message: error.message,
      });
    }
  }

  handleZonesToggleUpdate(clientId, message) {
    try {
      const { isZoneOn } = message;

      console.log(`Zones toggle update from client ${clientId}: ${isZoneOn}`);

      // Broadcast to all other clients (excluding sender)
      const broadcastData = {
        type: 'zones_toggle_update',
        isZoneOn,
        timestamp: new Date().toISOString(),
        source: clientId,
      };

      this.broadcastExcluding(clientId, broadcastData);

      this.sendToClient(clientId, {
        type: 'zones_toggle_update_confirmed',
        isZoneOn,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'error',
        message: error.message,
      });
    }
  }

  // NEW: Handle products updates from React app
  handleProductsUpdate(clientId, message) {
    try {
      const { generatedProductType } = message;

      console.log(
        `Products update from client ${clientId}: ${generatedProductType}`
      );

      // Broadcast to all other clients (excluding sender)
      const data = {
        type: 'products_update',
        generatedProductType,
        timestamp: new Date().toISOString(),
        source: clientId,
      };

      this.broadcastExcluding(clientId, data);

      // Send confirmation to sender
      this.sendToClient(clientId, {
        type: 'products_update_confirmed',
        generatedProductType,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'error',
        message: error.message,
      });
    }
  }

handleSortedObjectsUpdate(clientId, message) {
  try {
    // Change this line to use the correct key from the Unity message
    const { sortedObjectType } = message; 

    console.log(`Sorted objects update from client ${clientId}: ${sortedObjectType}`);

    // Broadcast to all other clients (including the frontend dashboard)
    const data = {
      type: 'sorted_objects_update',
      sortedObjectType,
      timestamp: new Date().toISOString(),
      source: clientId,
    };

    // Use broadcast method that sends to all clients, as Unity is a client and React dashboard is a client
    // If you want to send to everyone, use `broadcast(data)`
    // If you want to send only to clients with a subscription, use `broadcastToSubscription('sorted_objects_update', data)`
    this.broadcastToSubscription('sorted_objects_update', data);

  } catch (error) {
    this.sendToClient(clientId, {
      type: 'error',
      message: error.message,
    });
  }
}

// NEW: Handle unsorted objects updates from VR app
handleUnsortedObjectsUpdate(clientId, message) {
  try {
    // Change this line to use the correct key from the Unity message
    const { unsortedObjectType } = message;

    console.log(`Unsorted objects update from client ${clientId}: ${unsortedObjectType}`);

    // Broadcast to all other clients
    const data = {
      type: 'unsorted_objects_update',
      unsortedObjectType,
      timestamp: new Date().toISOString(),
      source: clientId,
    };

    this.broadcastToSubscription('unsorted_objects_update', data);

  } catch (error) {
      this.sendToClient(clientId, {
      type: 'error',
      message: error.message,
    });
  }
}

  // NEW: Handle errors updates from React app
  handleErrorsUpdate(clientId, message) {
    try {
      const { count } = message;
      if (typeof count !== 'number' || count < 0) {
        throw new Error('Errors count must be a non-negative number');
      }

      console.log(`Errors update from client ${clientId}: ${count}`);

      // Broadcast to all other clients (excluding sender)
      const data = {
        type: 'errors_update',
        count,
        timestamp: new Date().toISOString(),
        source: clientId,
      };

      this.broadcastExcluding(clientId, data);

      // Send confirmation to sender
      this.sendToClient(clientId, {
        type: 'errors_update_confirmed',
        count,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'error',
        message: error.message,
      });
    }
  }

  // NEW: Handle pickup zone updates from React app
  handlePickUpFromZone(clientId, message) {
    try {
      const { zone } = message;
      const validZones = ['red', 'green', 'yellow'];

      if (!zone || typeof zone !== 'string') {
        throw new Error('Zone must be a string');
      }

      if (!validZones.includes(zone.toLowerCase())) {
        throw new Error('Zone must be one of: red, green, yellow');
      }

      const normalizedZone = zone.toLowerCase();
      console.log(
        `Pickup from zone update from client ${clientId}: ${normalizedZone}`
      );

      // Broadcast to all other clients (excluding sender)
      const data = {
        type: 'pickup_zone_update',
        zone: normalizedZone,
        timestamp: new Date().toISOString(),
        source: clientId,
      };

      this.broadcastExcluding(clientId, data);

      // Send confirmation to sender
      this.sendToClient(clientId, {
        type: 'pickup_zone_update_confirmed',
        zone: normalizedZone,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'error',
        message: error.message,
      });
    }
  }
  handleSubscription(clientId, subscriptionData) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (Array.isArray(subscriptionData)) {
      subscriptionData.forEach((sub) => client.subscriptions.add(sub));
    } else {
      client.subscriptions.add(subscriptionData);
    }

    this.sendToClient(clientId, {
      type: 'subscription_confirmed',
      subscriptions: Array.from(client.subscriptions),
    });

    console.log(`Client ${clientId} subscribed to:`, subscriptionData);
  }

  handleUnsubscription(clientId, unsubscriptionData) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (Array.isArray(unsubscriptionData)) {
      unsubscriptionData.forEach((unsub) => client.subscriptions.delete(unsub));
    } else {
      client.subscriptions.delete(unsubscriptionData);
    }

    this.sendToClient(clientId, {
      type: 'unsubscription_confirmed',
      subscriptions: Array.from(client.subscriptions),
    });

    console.log(`Client ${clientId} unsubscribed from:`, unsubscriptionData);
  }

  // Send message to specific client
  sendToClient(clientId, data) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  // Broadcast to all clients
  broadcast(data) {
    const message = JSON.stringify(data);
    let sentCount = 0;

    this.clients.forEach((client, clientId) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
        sentCount++;
      } else {
        // Clean up disconnected clients
        this.clients.delete(clientId);
      }
    });

    return sentCount;
  }

  // Broadcast to all clients except the specified one
  broadcastExcluding(excludeClientId, data) {
    const message = JSON.stringify(data);
    let sentCount = 0;

    this.clients.forEach((client, clientId) => {
      if (
        clientId !== excludeClientId &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        client.ws.send(message);
        sentCount++;
      } else if (client.ws.readyState !== WebSocket.OPEN) {
        // Clean up disconnected clients
        this.clients.delete(clientId);
      }
    });

    return sentCount;
  }

  // Broadcast to clients with specific subscription
  broadcastToSubscription(subscriptionType, data) {
    const message = JSON.stringify(data);
    let sentCount = 0;

    this.clients.forEach((client, clientId) => {
      if (
        client.subscriptions.has(subscriptionType) &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        client.ws.send(message);
        sentCount++;
      } else if (client.ws.readyState !== WebSocket.OPEN) {
        // Clean up disconnected clients
        this.clients.delete(clientId);
      }
    });

    return sentCount;
  }

  // Get connected clients count
  getConnectedClientsCount() {
    return this.clients.size;
  }

  // Get client info
  getClientInfo(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return null;

    return {
      clientId,
      connectedAt: client.connectedAt,
      ip: client.ip,
      subscriptions: Array.from(client.subscriptions),
      isConnected: client.ws.readyState === WebSocket.OPEN,
    };
  }

  // Get all clients info
  getAllClientsInfo() {
    const clientsInfo = [];
    this.clients.forEach((client, clientId) => {
      clientsInfo.push(this.getClientInfo(clientId));
    });
    return clientsInfo;
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

export const initializeWebSocket = (wss) => {
  websocketService.initialize(wss);
};

export default websocketService;
