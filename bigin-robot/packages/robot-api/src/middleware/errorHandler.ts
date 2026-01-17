/**
 * Error Handler Middleware
 */

import { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '../types/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('❌ Error:', err);

  if (err instanceof ApiError) {
    const response: ApiResponse = {
      success: false,
      error: err.message,
      message: err.details || undefined
    };
    return res.status(err.status).json(response);
  }

  // Default error
  const response: ApiResponse = {
    success: false,
    error: 'Internal server error',
    message: err.message
  };
  return res.status(500).json(response);
}

export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
