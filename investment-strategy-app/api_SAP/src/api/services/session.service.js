const crypto = require('crypto');

// Servicio ultra ligero: guarda sesiones en memoria con un TTL configurable.
// Cada sesión conoce su token (lo enviamos al front), al usuario y la fecha de expiración.
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 8); // default 8h
const CLEANUP_INTERVAL_MS = Math.max(SESSION_TTL_MS / 2, 60_000); // evitamos barridos excesivos

const sessions = new Map(); // token -> { user, createdAt, expiresAt }

const generateToken = () => crypto.randomBytes(32).toString('hex'); // 256 bits randómicos

const normalizeUserPayload = (user = {}) => ({
  id: user.id || user.ID || user._id || null,
  email: user.email || '',
  name: user.name || user.user || '',
  username: user.user || '',
});

// Se llama desde /auth/login o /auth/register.
function createSession(user) {
  const token = generateToken();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = {
    user: normalizeUserPayload(user),
    createdAt: Date.now(),
    expiresAt,
  };
  sessions.set(token, payload);
  return { token, ...payload };
}

// Se invoca en cada request protegida (middleware sessionAuth).
function getSession(token) {
  if (!token || !sessions.has(token)) return null;
  const session = sessions.get(token);
  if (!session) return null;

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null; // sesión expirada, forzamos relogueo.
  }

  session.expiresAt = Date.now() + SESSION_TTL_MS; // sliding expiration
  sessions.set(token, session);
  return { token, ...session };
}

// Logout directo o limpieza manual.
function destroySession(token) {
  if (!token) return;
  sessions.delete(token);
}

// Útil para debugging si alguna vez queremos listar sesiones activas.
function listActiveSessions() {
  const out = [];
  sessions.forEach((value, key) => {
    out.push({ token: key, ...value });
  });
  return out;
}

// Barrido automático que remueve tokens vencidos cada cierto tiempo.
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (!session || session.expiresAt <= now) sessions.delete(token);
  }
}

setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL_MS).unref?.();

module.exports = {
  createSession,
  getSession,
  destroySession,
  listActiveSessions,
};
