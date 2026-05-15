# Mister F Agent Notes

Este documento existe para que un agente nuevo pueda entender el proyecto con contexto suficiente y empezar a trabajar sin reconstruir todo desde cero.

## Qué es Mister F

Mister F es una app web para practicar inglés con un tutor guiado por LLM.

La experiencia principal es un chat con estética de “hoja” minimalista. El tutor:

- propone retos;
- corrige al usuario;
- mantiene objetivos de aprendizaje;
- puede trabajar producción (`es -> en`) y comprensión (`en -> es`);
- persiste conversaciones, retos, intentos, progreso y vocabulario.

La app usa OpenRouter como único proveedor LLM.

## Stack

- Backend: Node.js + Express
- Lenguaje: TypeScript
- Templates: EJS
- CSS: Bootstrap + Bootswatch Journal
- Realtime: Socket.IO
- Base de datos: SQLite (`better-sqlite3`)
- Process manager: PM2

No hay React.

## Estructura general

- [src/server/server.ts](/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/server/server.ts): arranque de Express, rutas, Socket.IO.
- [src/socket/chatSocket.ts](/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/socket/chatSocket.ts): flujo principal del chat, retos, eventos de socket, compresión del historial.
- [src/services/llmTutor.ts](/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/services/llmTutor.ts): fachada pública del módulo LLM.
- [src/services/llmTutor/index.ts](/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/services/llmTutor/index.ts): orquestación principal de llamadas al LLM.
- [src/services/llmTutor/types.ts](/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/services/llmTutor/types.ts): tipos del protocolo estructurado.
- [src/services/llmTutor/schemas.ts](/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/services/llmTutor/schemas.ts): esquemas Zod/JSON Schema.
- [src/services/llmTutor/prompt.ts](/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/services/llmTutor/prompt.ts): construcción de prompts.
- [src/services/llmTutor/providers.ts](/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/services/llmTutor/providers.ts): integración con OpenRouter, selección de modelo y manejo de finish reasons.
- [src/services/llmTutor/challenges/*](/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/services/llmTutor/challenges): definiciones por tipo de reto (`produce_en`, `understand_en`, `dialogue_scene`).
- [src/db/repository.ts](/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/db/repository.ts): acceso a SQLite.
- [src/db/migrations.ts](/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/db/migrations.ts): migraciones.
- [src/auth/*](/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/auth): auth local, Google, sesiones, mailer.
- [src/services/openRouterUserKeys.ts](/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/services/openRouterUserKeys.ts): provisión y administración de API keys por usuario en OpenRouter.
- [views/index.ejs](/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/views/index.ejs): UI principal.
- [public/js/chat.js](/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/public/js/chat.js): frontend del chat y tabs.
- [src/client/styles/app.css](/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/client/styles/app.css): estilos globales fuente.
- [gameplays/system-prompt.md](/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/gameplays/system-prompt.md): system prompt central del tutor.
- [src/socket/initialGreetings.ts](/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/socket/initialGreetings.ts): saludos iniciales predefinidos.

## Experiencia actual del usuario

La app tiene una sola pantalla principal con:

- chat;
- panel lateral de conversaciones;
- tabs dentro de la hoja:
  - `Chat`
  - `Progreso`
  - `Intentos`
  - `Vocabulario`
- modal de traductor;
- auth propia por email/password y Google;
- `/superadmin` para ver usuarios y administrar su key de OpenRouter.

## Modelo mental del tutor

El tutor no responde texto libre sin estructura. Responde un objeto JSON con `blocks`.

El contrato se valida en servidor. Los bloques importantes hoy son:

- `message`
- `challenge_started`
- `character_message`
- `sentence_evaluation`
- `challenge_completed`
- `conversation_title`

El texto final visible en el chat se construye a partir de esos bloques.

## Tipos de reto actuales

Hoy existen tres tipos:

- `produce_en`: el tutor da una frase en español y el usuario responde en inglés.
- `understand_en`: el tutor da una frase en inglés y el usuario explica en español qué significa.
- `dialogue_scene`: el tutor presenta una escena con personaje ficticio y objetivos visibles; el usuario habla con el personaje mientras el tutor corrige desde fuera de la escena.

Cada reto guarda:

- `challengeType`
- `challengeLabel`
- `topic`
- `level`
- `objective`
- `score`
- `completedAt`

## Diálogo con personaje ficticio

En `dialogue_scene`:

- el tutor marca el inicio del diálogo con un `challenge_started` mínimo;
- luego explica la escena en texto normal;
- el personaje ficticio habla por `character_message`;
- el usuario responde como parte de la escena;
- el tutor corrige con `message` + `sentence_evaluation`;
- el tutor puede mencionar objetivos de forma libre en sus mensajes, pero no existe un bloque estructurado de progreso para ellos;
- el diálogo termina cuando el modelo decide cerrarlo con `challenge_completed`, normalmente porque la escena ya se resolvió de forma natural.

En UI:

- cada escena se renderiza dentro del mismo card del reto;
- el card no depende de metadata estructurada de escenario o roles;
- dentro del flujo del chat, los mensajes del personaje van en cards propios, visualmente distintos del tutor.

## Flujo de retos

### Regla importante

El reto actual ya no significa “reto no completado”.

El reto actual es **el último reto creado**.

Eso permite que un reto:

- se marque como completado (`challenge_completed`);
- pero siga siendo el foco conversacional para variantes o preguntas;
- y solo deje de ser el foco cuando aparezca un nuevo `challenge_started`.

### Consecuencia práctica

No se debe empezar y completar un reto en la misma respuesta.

El servidor rechaza una respuesta del LLM que contenga:

- `challenge_completed`
- y también `challenge_started`

en el mismo response.

Después de completar un reto, el tutor debe pedir confirmación para pasar al siguiente.

## Botón “Siguiente reto”

Cuando el último reto de la conversación está completado, el frontend muestra un botón `Siguiente reto` al final del card del reto.

Ese botón:

- no manda un mensaje visible al chat;
- emite `challenge:next` por socket;
- el servidor inyecta una instrucción interna al historial;
- el LLM debe responder con un nuevo `challenge_started`.

Si el usuario prefiere seguir sobre el mismo reto, simplemente escribe en el input.

## Tabs derivados

### Progreso

No se actualiza en cada turno.

Se genera bajo demanda cuando el usuario abre el tab. El dataset enviado al LLM es compacto y sale de los retos/intentios registrados.

Secciones requeridas hoy:

- `## Tema`
- `## Nivel`
- `## Objetivos`
- `## Avance de objetivos`
- `## Resumen`
- `## Errores frecuentes`
- `## Vocabulario`

### Vocabulario

También se genera bajo demanda y se persiste en DB.

## Persistencia

Tablas importantes:

- `users`
- `user_identities`
- `user_sessions`
- `auth_action_tokens`
- `user_openrouter_keys`
- `conversations`
- `messages`
- `conversation_progress`
- `sentence_challenges`
- `sentence_attempts`
- `conversation_vocabulary`
- `schema_migrations`

## Cómo se guarda un reto

Un reto se crea desde `challenge_started`, o como fallback al llegar una `sentence_evaluation` si todavía no existe un reto actual.

Los intentos del usuario se guardan en `sentence_attempts`.

La evaluación visual por partes se guarda en metadata del mensaje del usuario y también en `sentence_attempts.evaluation_json`.

## Compresión del historial para el LLM

La conversación no se manda completa siempre.

El servidor separa:

- reto actual: mensajes vivos;
- retos anteriores: historial comprimido.

Hoy la compresión usa una unidad por reto, no por mensaje.

Para retos normales, para cada reto previo se manda algo como:

- tipo
- tema
- nivel
- objetivo
- oración reto
- intentos del usuario

Para `dialogue_scene` hay dos niveles:

1. compresión ligera para las últimas escenas:
   - intro del tutor;
   - turnos del personaje ficticio;
   - turnos del usuario;
   - se omiten las intervenciones de guía del tutor.
2. compresión agresiva para escenas más viejas:
   - escenario;
   - roles;
   - objetivo;
   - logros completados;
   - últimos turnos importantes del usuario.

La lógica está en [src/socket/chatSocket.ts](/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/socket/chatSocket.ts), principalmente en:

- `buildTutorHistoryForLlm`
- `buildCompressedChallengeHistory`
- `buildCompactChallengeDataset`

## Auth

Auth local:

- signup/login por correo y password;
- verificación por correo con código;
- reset de password con código;
- sesiones persistentes en DB, no en memoria;
- Google login soportado.

El chat puede arrancar incluso sin sesión, pero al intentar enviar se fuerza el login/signup y luego se recupera el borrador del usuario.

## OpenRouter por usuario

Cada usuario tiene su propia API key de OpenRouter.

Esa key:

- se crea al crear el usuario;
- se cifra localmente;
- se usa para los requests LLM de ese usuario;
- tiene límite en USD configurable;
- ahora se crea como crédito único, sin reset automático.

Archivo clave:

- [src/services/openRouterUserKeys.ts](/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/src/services/openRouterUserKeys.ts)

## Superadmin

Ruta:

- `/superadmin`

Solo accesible si el correo del usuario coincide con `SUPERADMIN_EMAIL`.

Permite:

- ver usuarios;
- ver detalles de perfil;
- ver datos de la key OpenRouter;
- cambiar límite, reset, BYOK, disabled.

## Configuración sensible

La app depende bastante de env vars cargadas por PM2 en [ecosystem.config.cjs](/Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web/ecosystem.config.cjs).

Importantes:

- `APP_SESSION_SECRET`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MANAGEMENT_API_KEY`
- `OPENROUTER_KEY_ENCRYPTION_SECRET`
- `OPENROUTER_USER_KEY_LIMIT_USD`
- `SUPERADMIN_EMAIL`
- SMTP y Google OAuth

## UI y estilo

Decisiones actuales importantes:

- layout tipo hoja;
- sin header pesado;
- botones de icono sin borde ni fondo por defecto;
- mensajes del usuario en card;
- solo se usa el card del reto para agrupar el flujo del challenge;
- la evaluación se muestra en card dentro del mensaje del tutor;
- los mensajes del tutor usan serif;
- markdown renderizado en frontend.

## Cosas delicadas

1. **No mezclar texto visible con estado interno del reto**
   - Si el tutor muestra una nueva oración, debe existir un `challenge_started` coherente.

2. **No abrir y cerrar reto en el mismo response**
   - El servidor ya lo bloquea.

3. **El botón `Siguiente reto` depende del último reto completado**
   - Si se toca esta lógica, revisar `public/js/chat.js`.

4. **La compresión del historial afecta mucho el comportamiento del modelo**
   - Cambiarla puede alterar decisiones del tutor.

5. **Los tabs Progreso y Vocabulario son derivados**
   - No meterlos en el bucle principal del chat salvo que se cambie conscientemente el diseño.

## Estado funcional actual

La app ya permite:

- crear cuenta / login;
- practicar retos de producción y comprensión;
- persistir conversaciones e intentos;
- generar progreso y vocabulario;
- usar traductor modal;
- usar OpenRouter con key por usuario;
- usar superadmin.

## Próximas líneas naturales

Temas discutidos pero no implementados completamente:

- retos tipo diálogo con personaje ficticio;
- compresión por niveles para escenas de diálogo;
- nuevos game modes;
- dashboards/classrooms/teacher accounts.

## Mantenimiento de este documento

Actualizar este archivo cuando cambie algo importante en:

- arquitectura;
- protocolo del tutor;
- esquema de base de datos;
- auth;
- integración LLM;
- compresión del historial;
- UX principal.
