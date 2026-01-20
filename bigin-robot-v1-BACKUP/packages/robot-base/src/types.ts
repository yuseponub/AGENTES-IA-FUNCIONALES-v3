/**
 * Core types for Robot Base
 */

export interface RobotConfig {
  headless: boolean;
  slowMo?: number;
  screenshotsEnabled: boolean;
  storagePath: string;
}

export interface Screenshot {
  id: string;
  type: 'before' | 'after' | 'error';
  path: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SessionInfo {
  platform: string;
  isLoggedIn: boolean;
  cookiesPath?: string;
  lastActivity?: Date;
  expiresAt?: Date;
}

export interface RobotAction {
  actionId: string;
  type: string;
  args: Record<string, any>;
  screenshotBefore?: Screenshot;
  screenshotAfter?: Screenshot;
  result?: any;
  error?: Error;
  duration: number;
}

export interface VerificationResult {
  success: boolean;
  message: string;
  actual?: any;
  expected?: any;
  screenshot?: Screenshot;
}
