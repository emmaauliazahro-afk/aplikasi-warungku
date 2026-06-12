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

const webOrigin = isProduction
  ? required('WEB_ORIGIN')
  : required('WEB_ORIGIN', 'http://localhost:3000');

// --- Validations (fail fast on misconfig) ---
if (isProduction) {
  if (webOrigin === '*' || !/^https?:\/\//.test(webOrigin)) {
    throw new Error(
      'WEB_ORIGIN must be a non-wildcard http(s) URL in production (got: ' + webOrigin + ')'
    );
  }
  if (webOrigin.startsWith('http://')) {
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

export const env = {
  port: Number(process.env.PORT ?? 5000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret,
  jwtExpiresIn,
  nodeEnv,
  isProduction,
  webOrigin,
};
