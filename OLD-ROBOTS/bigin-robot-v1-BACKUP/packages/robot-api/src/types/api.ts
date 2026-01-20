/**
 * API Types
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  status: number;
  message: string;
  details?: any;
}

export interface RobotConfig {
  headless: boolean;
  screenshotsEnabled: boolean;
  storagePath: string;
}

// Re-export types from adapters
export type { CreateOrdenInput, BiginConfig } from '@modelo-ia/adapter-bigin';
