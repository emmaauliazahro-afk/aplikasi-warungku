import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { parseIdParam } from '../src/utils/params';
import { ApiError } from '../src/middleware/error';

function makeReq(params: Record<string, string | undefined>): Request {
  return { params } as unknown as Request;
}

describe('parseIdParam', () => {
  it('parses a positive integer id', () => {
    const req = makeReq({ id: '5' });
    expect(parseIdParam(req)).toBe(5);
  });

  it('throws ApiError 400 when id is non-numeric', () => {
    const req = makeReq({ id: 'abc' });
    expect(() => parseIdParam(req)).toThrow(ApiError);
    try {
      parseIdParam(req);
    } catch (e) {
      expect((e as ApiError).statusCode).toBe(400);
    }
  });

  it('throws ApiError 400 when id is 0 (must be positive)', () => {
    const req = makeReq({ id: '0' });
    expect(() => parseIdParam(req)).toThrow(ApiError);
    try {
      parseIdParam(req);
    } catch (e) {
      expect((e as ApiError).statusCode).toBe(400);
    }
  });

  it('throws ApiError 400 when id is negative', () => {
    const req = makeReq({ id: '-1' });
    expect(() => parseIdParam(req)).toThrow(ApiError);
    try {
      parseIdParam(req);
    } catch (e) {
      expect((e as ApiError).statusCode).toBe(400);
    }
  });

  it('throws ApiError 400 when id is not an integer (has decimal part)', () => {
    const req = makeReq({ id: '1.5' });
    expect(() => parseIdParam(req)).toThrow(ApiError);
    try {
      parseIdParam(req);
    } catch (e) {
      expect((e as ApiError).statusCode).toBe(400);
    }
  });

  it('throws ApiError 400 when id is an empty string', () => {
    const req = makeReq({ id: '' });
    expect(() => parseIdParam(req)).toThrow(ApiError);
    try {
      parseIdParam(req);
    } catch (e) {
      expect((e as ApiError).statusCode).toBe(400);
    }
  });

  it('throws ApiError 400 when id is undefined (missing)', () => {
    const req = makeReq({ id: undefined });
    expect(() => parseIdParam(req)).toThrow(ApiError);
    try {
      parseIdParam(req);
    } catch (e) {
      expect((e as ApiError).statusCode).toBe(400);
    }
  });

  it('uses a custom parameter name when provided', () => {
    const req = makeReq({ productId: '42' });
    expect(parseIdParam(req, 'productId')).toBe(42);
  });

  it('throws ApiError 400 for invalid value on custom parameter name', () => {
    const req = makeReq({ productId: 'not-a-number' });
    expect(() => parseIdParam(req, 'productId')).toThrow(ApiError);
    try {
      parseIdParam(req, 'productId');
    } catch (e) {
      expect((e as ApiError).statusCode).toBe(400);
    }
  });
});
