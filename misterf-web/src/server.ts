import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { Server } from 'socket.io';
import { env } from './config/env.js';
import { registerChatSocket } from './socket/chatSocket.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('view engine', 'ejs');
app.set('views', path.join(env.projectRoot, 'views'));

app.use('/public', express.static(path.join(env.projectRoot, 'public')));
app.use(
  '/vendor/bootswatch',
  express.static(path.join(env.projectRoot, 'node_modules/bootswatch/dist')),
);
app.use(
  '/vendor/marked',
  express.static(path.join(env.projectRoot, 'node_modules/marked/lib')),
);
app.use(
  '/vendor/dompurify',
  express.static(path.join(env.projectRoot, 'node_modules/dompurify/dist')),
);

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
