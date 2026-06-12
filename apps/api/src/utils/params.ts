import { Request } from 'express';
import { ApiError } from '../middleware/error';

/**
 * Parse a numeric :id path param. Throws a 400 ApiError if missing or non-numeric.
 * Use in controllers to replace the repeated `Number(req.params.id) + isNaN` dance.
 */
export function parseIdParam(req: Request, name = 'id'): number {
  const raw = req.params[name];
  if (raw === undefined || raw === null || raw === '') {
    throw new ApiError(400, 'ID tidak valid');
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ApiError(400, 'ID tidak valid');
  }
  return n;
}
