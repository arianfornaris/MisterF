# Mister F Web

Mister F es una app web simple para practicar escritura de frases en ingles con un tutor IA configurable mediante AI SDK.

## Stack

- Node.js + Express
- TypeScript
- EJS
- Bootstrap
- Socket.IO
- SQLite
- Migraciones propias
- AI SDK con proveedores Google, OpenAI, OpenRouter y Anthropic

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

La configuracion de PM2 esta en `ecosystem.config.cjs`. Cambia el proveedor y el modelo con `LLM_PROVIDER` y `LLM_MODEL`.

PM2 recibe estas variables:

```text
NODE_ENV=production
PORT=3000
LLM_PROVIDER=google
LLM_MODEL=gemini-2.5-flash
GEMINI_API_KEY=...
OPENAI_API_KEY=...
OPENROUTER_API_KEY=...
ANTHROPIC_API_KEY=...
```

Valores soportados para `LLM_PROVIDER`: `google`, `openai`, `openrouter`, `anthropic`.

Para guardar el proceso y reactivarlo al reiniciar la maquina:

```bash
pm2 save
pm2 startup
```
