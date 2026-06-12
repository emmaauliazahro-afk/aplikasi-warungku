import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}

// Wraps async route handlers to forward errors to the error middleware
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Minimal structured logger. We avoid pulling in pino/winston for now; this
// emits a single JSON line per event so log shippers can parse it cheaply.
// Replace with pino when the project gains a log aggregator.
type LogLevel = 'info' | 'warn' | 'error';
function log(level: LogLevel, event: string, fields: Record<string, unknown>) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const requestId = (req as { id?: string }).id;

  if (err instanceof ZodError) {
    log('warn', 'validation_error', {
      requestId,
      path: req.originalUrl,
      method: req.method,
      issues: err.issues.map((i) => ({ path: i.path.join('.'), msg: i.message })),
    });
    return res.status(400).json({
      success: false,
      message: 'Validasi gagal',
      errors: err.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    });
  }

  if (err instanceof ApiError) {
    if (err.statusCode >= 500) {
      log('error', 'api_error', {
        requestId,
        path: req.originalUrl,
        method: req.method,
        status: err.statusCode,
        message: err.message,
      });
    }
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Multer upload errors (e.g. file too large)
  if (err.name === 'MulterError') {
    const message =
      (err as { code?: string }).code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran file terlalu besar (maksimal 5 MB)'
        : 'Gagal mengunggah file';
    return res.status(400).json({ success: false, message });
  }

  log('error', 'unhandled_error', {
    requestId,
    path: req.originalUrl,
    method: req.method,
    name: err.name,
    message: err.message,
    stack: err.stack,
  });
  return res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan pada server',
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: `Route tidak ditemukan: ${req.method} ${req.originalUrl}`,
  });
}
