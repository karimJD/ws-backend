import { WebSocket } from 'ws';

class WebSocketService {
  constructor() {
    this.clients = new Map();
  }

  initialize(wss) {
    this.wss = wss;

    wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();

      // Store client connection
      this.clients.set(clientId, {
        ws,
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
      case 'game_start_confirmation':
        this.handleGameStartConfirmation(clientId, message);
        break;
      case 'hand_pickup_object':
        this.handleHandPickupObject(clientId, message);
        break;
      case 'emergency_stop':
        this.handleEmergencyStop(clientId, message);
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
      const { table } = message;
      console.log(`Table update from client ${clientId}: ${table}`);

      // Broadcast to all other clients (excluding sender)
      const data = {
        type: 'table_update',
        table,
        timestamp: new Date().toISOString(),
        source: clientId,
      };

      this.broadcastExcluding(clientId, data);

      // Send confirmation to sender
      this.sendToClient(clientId, {
        type: 'table_update_confirmed',
        table,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'error',
        message: error.message,
      });
    }
  }

  // Handle game start updates from React app
  handleGameStartUpdate(clientId, message) {
    try {
      const { gameStart } = message;
      if (typeof gameStart !== 'boolean') {
        throw new Error('gameStart must be a boolean');
      }

      console.log(`Game start update from client ${clientId}: ${gameStart}`);

      // Broadcast to all other clients (excluding sender)
      const data = {
        type: 'game_start_update',
        gameStart,
        timestamp: new Date().toISOString(),
        source: clientId,
      };

      this.broadcastExcluding(clientId, data);

      // Send confirmation to sender
      this.sendToClient(clientId, {
        type: 'game_start_update_confirmed',
        gameStart,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'error',
        message: error.message,
      });
    }
  }

  // Handle game start confirmation from VR app
  handleGameStartConfirmation(clientId, message) {
    try {
      const { gameStart } = message;
      if (typeof gameStart !== 'boolean') {
        throw new Error('gameStart must be a boolean');
      }

      console.log(
        `Game start confirmation from client ${clientId}: ${gameStart}`
      );

      // Broadcast to all other clients (excluding sender)
      const data = {
        type: 'game_start_confirmation',
        gameStart,
        timestamp: new Date().toISOString(),
        source: clientId,
      };

      this.broadcastExcluding(clientId, data);
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'error',
        message: error.message,
      });
    }
  }

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
      const data = {
        type: 'zones_toggle_update',
        isZoneOn,
        timestamp: new Date().toISOString(),
        source: clientId,
      };

      this.broadcastExcluding(clientId, data);

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
      const { TotalEchec, TotalReussite, TotalOublie } = message;
      let data = {};

      if (TotalEchec !== undefined) {
        data = {
          type: 'counter',
          TotalEchec,
          timestamp: new Date().toISOString(),
          source: clientId,
        };
        console.log(`Errors update ${clientId}: ${TotalEchec}`);
      }

      if (TotalReussite !== undefined) {
        data = {
          type: 'counter',
          TotalReussite,
          timestamp: new Date().toISOString(),
          source: clientId,
        };
        console.log(`Success update ${clientId}: ${TotalReussite}`);
      }

      if (TotalOublie !== undefined) {
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
      const { green, red, orange } = message;
      let data;

      if (green !== undefined) {
        data = {
          type: 'zone_entered',
          green,
          timestamp: new Date().toISOString(),
          source: clientId,
        };
        console.log(`Object picked up from GREEN ZONE ${clientId}: ${green}`);
      }

      if (red !== undefined) {
        data = {
          type: 'zone_entered',
          red,
          timestamp: new Date().toISOString(),
          source: clientId,
        };
        console.log(`Object picked up from RED ZONE ${clientId}: ${red}`);
      }

      if (orange !== undefined) {
        data = {
          type: 'zone_entered',
          orange,
          timestamp: new Date().toISOString(),
          source: clientId,
        };
        console.log(`Object picked up from YELLOW ZONE ${clientId}: ${orange}`);
      }

      if (data) {
        this.broadcastExcluding(clientId, data);
      }
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'error',
        message: error.message,
      });
    }
  }

  handleHandPickupObject(clientId, message) {
    try {
      const { hand, handCount } = message;
      console.log(
        `User picked up object with ${hand} hand, count: ${handCount} from client ${clientId}`
      );

      if (hand !== 'left' && hand !== 'right') {
        throw new Error("hand must be 'left' or 'right'");
      }
      if (typeof handCount !== 'number' || handCount < 0) {
        throw new Error('handCount must be a non-negative number');
      }

      // Broadcast to all other clients (excluding sender)
      const data = {
        type: 'hand_pickup_object',
        hand,
        handCount,
        timestamp: new Date().toISOString(),
        source: clientId,
      };

      this.broadcastExcluding(clientId, data);

      this.sendToClient(clientId, {
        type: 'hand_pickup_object_confirmed',
        hand,
        handCount,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'error',
        message: error.message,
      });
    }
  }

  handleEmergencyStop(clientId, message) {
    try {
      const { isEmergencyStop } = message;
      console.log(
        `User triggered emergency stop ${isEmergencyStop}, from client ${clientId}`
      );

      // Broadcast to all other clients (excluding sender)
      const data = {
        type: 'emergency_stop',
        isEmergencyStop,
        timestamp: new Date().toISOString(),
        source: clientId,
      };

      this.broadcastExcluding(clientId, data);

      this.sendToClient(clientId, {
        type: 'emergency_stop_confirmed',
        isEmergencyStop,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'error',
        message: error.message,
      });
    }
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

  // Get connected clients count
  getConnectedClientsCount() {
    return this.clients.size;
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
