import 'dotenv/config';

function required(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, '');
}

function parseOrigins(value: string): string[] {
  return value
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
}

const webOrigin = isProduction
  ? required('WEB_ORIGIN')
  : required('WEB_ORIGIN', 'http://localhost:3000');
const webOrigins = parseOrigins(webOrigin);

// --- Validations (fail fast on misconfig) ---
if (webOrigins.length === 0) {
  throw new Error('WEB_ORIGIN must contain at least one origin.');
}
if (isProduction) {
  const invalidOrigin = webOrigins.find(
    (origin) => origin === '*' || !/^https?:\/\//.test(origin)
  );
  if (invalidOrigin) {
    throw new Error(
      'WEB_ORIGIN must contain non-wildcard http(s) URLs in production (got: ' +
        invalidOrigin +
        ')'
    );
  }
  if (webOrigins.some((origin) => origin.startsWith('http://'))) {
    console.warn(
      '[env] WARNING: WEB_ORIGIN uses http:// in production. Cookies will only be sent over http; consider https://.'
    );
  }
}

const jwtSecret = required('JWT_SECRET');
const WEAK_SECRETS = new Set([
  '',
  'your-secret-key-here',
  'change-me',
  'warung-secret-key-change-in-production',
  'secret',
  'jwt-secret',
]);
if (isProduction && WEAK_SECRETS.has(jwtSecret)) {
  throw new Error(
    'JWT_SECRET is set to a known weak/default value. Refusing to start in production. Generate one with: openssl rand -hex 32'
  );
}
if (jwtSecret.length < 32) {
  if (isProduction) {
    throw new Error('JWT_SECRET must be at least 32 characters in production.');
  }
  console.warn(
    `[env] WARNING: JWT_SECRET is only ${jwtSecret.length} chars; use at least 32 for production.`
  );
}

const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? '7d';
// Accepts jsonwebtoken duration format: number (seconds) or string like '7d'/'24h'/'30m'/'60s'
const expiresInValid =
  /^\d+$/.test(jwtExpiresIn) || /^\d+(ms|s|m|h|d|w|y)$/.test(jwtExpiresIn);
if (!expiresInValid) {
  throw new Error(
    `JWT_EXPIRES_IN must be a duration like "7d", "24h", "30m", or seconds as integer (got: "${jwtExpiresIn}").`
  );
}

const cookieSameSite = (process.env.COOKIE_SAME_SITE ??
  (isProduction ? 'none' : 'lax')) as 'lax' | 'strict' | 'none';
if (!['lax', 'strict', 'none'].includes(cookieSameSite)) {
  throw new Error('COOKIE_SAME_SITE must be one of: lax, strict, none.');
}
if (cookieSameSite === 'none' && !isProduction) {
  console.warn(
    '[env] WARNING: COOKIE_SAME_SITE=none requires secure cookies; use production/https for browser compatibility.'
  );
}

export const env = {
  port: Number(process.env.PORT ?? 5000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret,
  jwtExpiresIn,
  nodeEnv,
  isProduction,
  webOrigin: webOrigins[0],
  webOrigins,
  cookieSameSite,
};
