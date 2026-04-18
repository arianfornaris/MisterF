import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { Server } from 'socket.io';
import { env } from './config/env.js';
import { migrate } from './db/migrator.js';
import { registerChatSocket } from './socket/chatSocket.js';

migrate();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('view engine', 'ejs');
app.set('views', path.join(env.projectRoot, 'views'));

app.use('/public', express.static(path.join(env.projectRoot, 'public')));

app.get('/', (_request, response) => {
  response.render('index', {
    title: 'Mister F',
    geminiModel: env.geminiModel,
  });
});

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

registerChatSocket(io);

server.listen(env.port, () => {
  console.log(`Mister F listening on http://localhost:${env.port}`);
});
