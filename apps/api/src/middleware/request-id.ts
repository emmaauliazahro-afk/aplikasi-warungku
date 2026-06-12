import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Attach a request ID to every incoming request. If the client sends a
 * well-formed `x-request-id` header we trust it (and echo it back); otherwise
 * we generate a UUID. The ID is exposed on `req.id` and echoed in the response
 * header so logs and clients can correlate.
 */
export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header('x-request-id');
  const id =
    incoming && /^[A-Za-z0-9._-]{1,128}$/.test(incoming) ? incoming : randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  next();
}
