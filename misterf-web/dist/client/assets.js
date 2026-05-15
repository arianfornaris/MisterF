import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
const manifestPath = path.join(env.projectRoot, 'public', 'build', '.vite', 'manifest.json');
let cachedManifestMtimeMs = -1;
let cachedChatScriptPath = '/public/build/chat.js';
export function getChatClientScriptPath() {
    try {
        const stats = fs.statSync(manifestPath);
        if (stats.mtimeMs !== cachedManifestMtimeMs) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            const chatEntry = manifest['src/client/chat/index.js'];
            cachedChatScriptPath = chatEntry?.file
                ? `/public/build/${chatEntry.file}`
                : '/public/build/chat.js';
            cachedManifestMtimeMs = stats.mtimeMs;
        }
    }
    catch {
        cachedChatScriptPath = '/public/build/chat.js';
    }
    return cachedChatScriptPath;
}
//# sourceMappingURL=assets.js.map