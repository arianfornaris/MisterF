import { randomUUID } from 'node:crypto';
import { getDb } from '../db/database.js';
function toAuthUser(row) {
    return {
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        passwordHash: row.password_hash,
        emailVerified: row.email_verified === 1,
    };
}
function toSuperadminUser(row) {
    return {
        ...toAuthUser(row),
        createdAt: row.created_at,
        disabledAt: row.disabled_at,
        identityProviders: row.identity_providers
            ? row.identity_providers.split(',').filter(Boolean)
            : [],
        updatedAt: row.updated_at,
    };
}
export function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
export function findUserByEmail(email) {
    const row = getDb()
        .prepare(`
        SELECT id, email, full_name, password_hash, email_verified
        FROM users
        WHERE email = ? AND disabled_at IS NULL
      `)
        .get(normalizeEmail(email));
    return row ? toAuthUser(row) : null;
}
export function findUserById(userId) {
    const row = getDb()
        .prepare(`
        SELECT id, email, full_name, password_hash, email_verified
        FROM users
        WHERE id = ? AND disabled_at IS NULL
      `)
        .get(userId);
    return row ? toAuthUser(row) : null;
}
export function findUserForSuperadmin(userId) {
    const row = getDb()
        .prepare(`
        SELECT
          users.id,
          users.email,
          users.full_name,
          users.password_hash,
          users.email_verified,
          users.created_at,
          users.updated_at,
          users.disabled_at,
          GROUP_CONCAT(user_identities.provider) AS identity_providers
        FROM users
        LEFT JOIN user_identities ON user_identities.user_id = users.id
        WHERE users.id = ?
        GROUP BY users.id
      `)
        .get(userId);
    return row ? toSuperadminUser(row) : null;
}
export function listUsersForSuperadmin() {
    const rows = getDb()
        .prepare(`
        SELECT
          users.id,
          users.email,
          users.full_name,
          users.password_hash,
          users.email_verified,
          users.created_at,
          users.updated_at,
          users.disabled_at,
          GROUP_CONCAT(user_identities.provider) AS identity_providers
        FROM users
        LEFT JOIN user_identities ON user_identities.user_id = users.id
        GROUP BY users.id
        ORDER BY datetime(users.created_at) DESC, users.email ASC
      `)
        .all();
    return rows.map(toSuperadminUser);
}
export function findUserByIdentity(input) {
    const row = getDb()
        .prepare(`
        SELECT users.id, users.email, users.full_name, users.password_hash, users.email_verified
        FROM user_identities
        INNER JOIN users ON users.id = user_identities.user_id
        WHERE user_identities.provider = ?
          AND user_identities.provider_subject = ?
          AND users.disabled_at IS NULL
      `)
        .get(input.provider, input.providerSubject);
    return row ? toAuthUser(row) : null;
}
export function findUserBySessionTokenHash(tokenHash) {
    const row = getDb()
        .prepare(`
        SELECT users.id, users.email, users.full_name, users.password_hash, users.email_verified
        FROM user_sessions
        INNER JOIN users ON users.id = user_sessions.user_id
        WHERE user_sessions.token_hash = ?
          AND user_sessions.revoked_at IS NULL
          AND datetime(user_sessions.expires_at) > CURRENT_TIMESTAMP
          AND users.disabled_at IS NULL
      `)
        .get(tokenHash);
    if (!row) {
        return null;
    }
    getDb()
        .prepare(`
        UPDATE user_sessions
        SET last_seen_at = CURRENT_TIMESTAMP
        WHERE token_hash = ?
      `)
        .run(tokenHash);
    return toAuthUser(row);
}
export function createLocalUser(input) {
    const db = getDb();
    const id = randomUUID();
    const email = normalizeEmail(input.email);
    const create = db.transaction(() => {
        db.prepare(`
        INSERT INTO users (id, email, full_name, password_hash)
        VALUES (?, ?, ?, ?)
      `).run(id, email, input.fullName.trim(), input.passwordHash);
        db.prepare(`
        INSERT INTO user_identities (id, user_id, provider, provider_subject, email)
        VALUES (?, ?, 'local', ?, ?)
      `).run(randomUUID(), id, email, email);
    });
    create();
    const user = findUserByEmail(email);
    if (!user) {
        throw new Error('Could not load newly created user.');
    }
    return user;
}
export function createExternalUser(input) {
    const db = getDb();
    const id = randomUUID();
    const email = normalizeEmail(input.email);
    const create = db.transaction(() => {
        db.prepare(`
        INSERT INTO users (
          id,
          email,
          full_name,
          password_hash,
          email_verified
        )
        VALUES (?, ?, ?, NULL, ?)
      `).run(id, email, input.fullName.trim(), input.emailVerified ? 1 : 0);
        db.prepare(`
        INSERT INTO user_identities (
          id,
          user_id,
          provider,
          provider_subject,
          email
        )
        VALUES (?, ?, ?, ?, ?)
      `).run(randomUUID(), id, input.provider, input.providerSubject, email);
    });
    create();
    const user = findUserByEmail(email);
    if (!user) {
        throw new Error('Could not load newly created external user.');
    }
    return user;
}
export function deleteUserById(userId) {
    getDb()
        .prepare('DELETE FROM users WHERE id = ?')
        .run(userId);
}
export function linkUserIdentity(input) {
    getDb()
        .prepare(`
        INSERT OR IGNORE INTO user_identities (
          id,
          user_id,
          provider,
          provider_subject,
          email
        )
        VALUES (?, ?, ?, ?, ?)
      `)
        .run(randomUUID(), input.userId, input.provider, input.providerSubject, normalizeEmail(input.email));
}
export function createSession(input) {
    getDb()
        .prepare(`
        INSERT INTO user_sessions (
          id,
          user_id,
          token_hash,
          expires_at,
          user_agent,
          ip_address
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `)
        .run(randomUUID(), input.userId, input.tokenHash, input.expiresAt.toISOString(), input.userAgent ?? null, input.ipAddress ?? null);
}
export function createAuthActionToken(input) {
    const db = getDb();
    const create = db.transaction(() => {
        db.prepare(`
        UPDATE auth_action_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND type = ? AND used_at IS NULL
      `).run(input.userId, input.type);
        db.prepare(`
        INSERT INTO auth_action_tokens (
          id,
          user_id,
          type,
          token_hash,
          expires_at
        )
        VALUES (?, ?, ?, ?, ?)
      `).run(randomUUID(), input.userId, input.type, input.tokenHash, input.expiresAt.toISOString());
    });
    create();
}
export function findUserByAuthActionToken(input) {
    const row = getDb()
        .prepare(`
        SELECT users.id, users.email, users.full_name, users.password_hash, users.email_verified
        FROM auth_action_tokens
        INNER JOIN users ON users.id = auth_action_tokens.user_id
        WHERE auth_action_tokens.token_hash = ?
          AND auth_action_tokens.type = ?
          AND auth_action_tokens.used_at IS NULL
          AND datetime(auth_action_tokens.expires_at) > CURRENT_TIMESTAMP
          AND users.disabled_at IS NULL
      `)
        .get(input.tokenHash, input.type);
    return row ? toAuthUser(row) : null;
}
export function markAuthActionTokenUsed(tokenHash) {
    getDb()
        .prepare(`
        UPDATE auth_action_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE token_hash = ? AND used_at IS NULL
      `)
        .run(tokenHash);
}
export function markEmailVerified(userId) {
    getDb()
        .prepare(`
        UPDATE users
        SET email_verified = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
        .run(userId);
}
export function updateUserPassword(input) {
    getDb()
        .prepare(`
        UPDATE users
        SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
        .run(input.passwordHash, input.userId);
}
export function revokeUserSessions(userId) {
    getDb()
        .prepare(`
        UPDATE user_sessions
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND revoked_at IS NULL
      `)
        .run(userId);
}
export function revokeSession(tokenHash) {
    getDb()
        .prepare(`
        UPDATE user_sessions
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE token_hash = ? AND revoked_at IS NULL
      `)
        .run(tokenHash);
}
//# sourceMappingURL=repository.js.map