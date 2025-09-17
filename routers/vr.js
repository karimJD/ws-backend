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

  // NEW: Send game end status to all clients
  sendGameEnd(isGameOver) {
    const data = {
      type: 'game_end_update',
      isGameOver,
      timestamp: new Date().toISOString(),
    };
    return this.broadcast(data);
  }

  // NEW: Send products data to all clients
  sendProducts(generatedProductType) {
    const data = {
      type: 'DestroyedTrash',
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
    // const validZones = ['red', 'green', 'yellow'];
    // if (!validZones.includes(zone.toLowerCase())) {
    //   throw new Error('Zone must be one of: red, green, yellow');
    // }
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
      case 'game_end_update':
        this.handleGameEndUpdate(clientId, message);
        break;
      case 'zones_toggle_update':
        this.handleZonesToggleUpdate(clientId, message);
        break;
      case 'DestroyedTrash':
        this.handleProductsUpdate(clientId, message);
        break;
      case 'counter':
        this.handleCountersUpdate(clientId, message);
        break;
      case 'zone_entered':
        this.handleZoneEntered(clientId, message);
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

  // NEW: Handle game end updates from React app
  handleGameEndUpdate(clientId, message) {
    try {
      const { isGameOver } = message;

      console.log(`Game end update from client ${clientId}: ${isGameOver}`);

      // Broadcast to all other clients (excluding sender)
      const data = {
        type: 'game_end_update',
        isGameOver,
        timestamp: new Date().toISOString(),
        source: clientId,
      };

      this.broadcastExcluding(clientId, data);

      // Send confirmation to sender
      this.sendToClient(clientId, {
        type: 'game_end_update_confirmed',
        isGameOver,
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
      const { object_name } = message;

      console.log(`Products update from client ${clientId}: ${object_name}`);

      // Broadcast to all other clients (excluding sender)
      const data = {
        type: 'DestroyedTrash',
        object_name,
        timestamp: new Date().toISOString(),
        source: clientId,
      };

      this.broadcastExcluding(clientId, data);

      // Send confirmation to sender
      this.sendToClient(clientId, {
        type: 'DestroyedTrash_confirmed',
        object_name,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'error',
        message: error.message,
      });
    }
  }

  handleCountersUpdate(clientId, message) {
    try {
      // Change this line to use the correct key from the Unity message
      const { TotalEchec, TotalReussite, TotalOublie } = message;
      let data = {};

      if (TotalEchec) {
        data = {
          type: 'counter',
          TotalEchec,
          timestamp: new Date().toISOString(),
          source: clientId,
        };
        console.log(`Errors update ${clientId}: ${TotalEchec}`);
      }

      if (TotalReussite) {
        data = {
          type: 'counter',
          TotalReussite,
          timestamp: new Date().toISOString(),
          source: clientId,
        };

        console.log(`Success update ${clientId}: ${TotalEchec}`);
      }

      if (TotalOublie) {
        data = {
          type: 'counter',
          TotalOublie,
          timestamp: new Date().toISOString(),
          source: clientId,
        };

        console.log(`Missed update ${clientId}: ${TotalOublie}`);
      }

      this.broadcastExcluding(clientId, data);
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'error',
        message: error.message,
      });
    }
  }

  handleZoneEntered(clientId, message) {
    try {
      const { green, red, yellow } = message;

      let data;

      if (green) {
        data = {
          type: 'zone_entered',
          green,
          timestamp: new Date().toISOString(),
          source: clientId,
        };

        console.log(`Object picked up from GREEN ZONE ${clientId}: ${green}`);
      }

      if (red) {
        data = {
          type: 'zone_entered',
          red,
          timestamp: new Date().toISOString(),
          source: clientId,
        };

        console.log(`Object picked up from GREEN ZONE ${clientId}: ${red}`);
      }

      if (yellow) {
        data = {
          type: 'zone_entered',
          yellow,
          timestamp: new Date().toISOString(),
          source: clientId,
        };

        console.log(`Object picked up from GREEN ZONE ${clientId}: ${yellow}`);
      }

      this.broadcastExcluding('zone_entered', data);
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
