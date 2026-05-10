# Mister F Web

Mister F es una app web simple para practicar escritura de frases en ingles con un tutor IA integrado mediante AI SDK sobre OpenRouter.

## Stack

- Node.js + Express
- TypeScript
- EJS
- Bootstrap
- Socket.IO
- SQLite
- Migraciones propias
- AI SDK con OpenRouter

## Uso

```bash
npm install
npm run pm2:start
```

Abre:

```text
http://localhost:3000
```

## Scripts

- `npm run dev`: servidor con recarga via `tsx watch`
- `npm run build`: compila TypeScript a `dist`
- `npm start`: ejecuta la version compilada
- `npm run typecheck`: valida tipos sin compilar
- `npm run pm2:start`: compila y arranca PM2 en modo produccion
- `npm run pm2:restart`: compila y reinicia PM2 actualizando variables
- `npm run pm2:status`: muestra el estado de PM2
- `npm run pm2:stop`: detiene la app en PM2
- `npm run pm2:delete`: elimina la app de PM2
- `npm run pm2:logs`: muestra logs de la app en PM2

## PM2

La configuracion de PM2 esta en `ecosystem.config.cjs`. El proveedor LLM es OpenRouter y puedes cambiar el modelo con `LLM_MODEL`.

PM2 recibe estas variables:

```text
NODE_ENV=production
PORT=3000
LLM_MODEL=openai/gpt-5-mini
OPENROUTER_API_KEY=...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

Para guardar el proceso y reactivarlo al reiniciar la maquina:

```bash
pm2 save
pm2 startup
```
