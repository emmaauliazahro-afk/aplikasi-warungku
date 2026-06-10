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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
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

  console.error('Unexpected error:', err);
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
