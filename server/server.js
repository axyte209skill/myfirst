/**
 * server.js
 * Boots the HTTP + Socket.io server. Serves the existing client files
 * (index.html, css/, js/) as static assets and hands every socket
 * connection to socketHandlers.js, which is the only code allowed to
 * touch a room's GameEngine.
 */

import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { RoomManager } from "./RoomManager.js";
import { registerSocketHandlers } from "./socketHandlers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const app = express();
app.use(express.static(projectRoot));

const httpServer = createServer(app);
const io = new Server(httpServer);
const rooms = new RoomManager();

io.on("connection", (socket) => {
  registerSocketHandlers(io, socket, rooms);
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Monopoly Deal server running at http://localhost:${PORT}`);
});
