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

## Reading the server logs

The server runs under pm2, which captures stdout/stderr to files, so you can
read logs directly without restarting.

- List processes and their names: `pm2 list`. The main checkout runs as
  `misterf-web`; a worktree running as the active local app (see
  `parallel-agent-worktrees`) runs as `misterf-web-worktree`.
- Tail recent output without following (one-shot, safe in an agent):

  ```bash
  pm2 logs <name> --lines 80 --nostream        # add --err for errors only
  ```

- Or read the files directly: `~/.pm2/logs/<name>-out.log` and
  `~/.pm2/logs/<name>-error.log`.
- Application logs are structured JSON lines. Filter by event, e.g.
  `grep scene_media_creation_failed ~/.pm2/logs/misterf-web-worktree-error.log`.
- Uncaught startup/build errors (esbuild/tsc transform failures, crashes) land
  in the `-error.log`; a stale transform error there can be from an edit that
  was mid-flight during a restart — confirm against the current file before
  treating it as real.
