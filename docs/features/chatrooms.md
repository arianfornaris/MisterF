# Chat Rooms Archive

Status: removed from the active product in Resource Simplification V2 Slice 7.

The former `Salas de chat` feature let users create multi-character group chat
scenarios, run plain-text conversations, evaluate those conversations, and
generate follow-up practice modules from the resulting report.

This feature is no longer an active product area:

- the sidebar entry has been removed
- `/chatrooms` and `/chatroom-conversations/*` redirect to `/resources`
- chatroom views, client entrypoints, prompt files, and runtime services have
  been removed
- the tutor runtime no longer receives chatroom report context or chatroom
  tools

The useful learning idea behind chatrooms may return later as `Diálogos`, but
that should be a new resource-shaped feature rather than a direct restoration
of the old room/conversation/report model.

## Legacy Persistence

Legacy chatroom tables and repository helpers may still exist until the planned
schema reset or an explicit destructive migration removes them. Do not build new
features against those legacy helpers.

See:

- [Resource Simplification V2](./resource-simplification-v2.md)
- [Resource Simplification V2 Tracker](../issues/resource-simplification-v2-tracker.md)
