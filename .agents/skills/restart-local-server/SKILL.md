---
name: restart-local-server
description: Use when making changes in this Mister F project that affect the local server. Restart the local server before finishing and state clearly whether the restart was completed.
---

# Restart Local Server

When you make changes in this project that affect the local server behavior, restart the local server before finishing the task.

Treat these as server-affecting changes:

- edits in `misterf-web/src/`
- changes in `misterf-web/views/`
- config or runtime changes that require a server restart

Default restart command:

```bash
cd /Users/arian/Documents/GameDev/MatandileGames/MisterF/misterf-web && npm run pm2:restart
```

Workflow:

1. Make the requested changes.
2. Restart the local server if the changes affect it.
3. In the final response, explicitly say whether the local server was restarted.

Do not skip the restart silently.
