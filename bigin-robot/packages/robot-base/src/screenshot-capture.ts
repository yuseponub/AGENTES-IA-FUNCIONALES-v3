/**
 * Screenshot Capture - Evidence management
 */

import { nanoid } from 'nanoid';
import path from 'path';
import type { Screenshot, RobotConfig } from './types';
import type { PlaywrightEngine } from './playwright-engine';

export class ScreenshotCapture {
  private config: RobotConfig;
  private engine: PlaywrightEngine;

  constructor(engine: PlaywrightEngine, config: RobotConfig) {
    this.engine = engine;
    this.config = config;
  }

  /**
   * Capture screenshot with metadata
   */
  async capture(
    type: 'before' | 'after' | 'error',
    metadata?: Record<string, any>
  ): Promise<Screenshot> {
    if (!this.config.screenshotsEnabled) {
      return this.createEmptyScreenshot(type);
    }

    const screenshot: Screenshot = {
      id: nanoid(12),
      type,
      path: this.generatePath(type),
      timestamp: new Date(),
      metadata
    };

    await this.engine.screenshot(screenshot.path, true);

    return screenshot;
  }

  /**
   * Capture before action
   */
  async before(actionType: string, args?: any): Promise<Screenshot> {
    return await this.capture('before', {
      actionType,
      args
    });
  }

  /**
   * Capture after action
   */
  async after(actionType: string, result?: any): Promise<Screenshot> {
    return await this.capture('after', {
      actionType,
      result
    });
  }

  /**
   * Capture on error
   */
  async error(actionType: string, error: Error): Promise<Screenshot> {
    return await this.capture('error', {
      actionType,
      error: error.message,
      stack: error.stack
    });
  }

  /**
   * Generate screenshot path
   */
  private generatePath(type: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${type}-${timestamp}-${nanoid(6)}.png`;
    return path.join(this.config.storagePath, 'artifacts', filename);
  }

  /**
   * Create empty screenshot object (when disabled)
   */
  private createEmptyScreenshot(type: 'before' | 'after' | 'error'): Screenshot {
    return {
      id: nanoid(12),
      type,
      path: '',
      timestamp: new Date()
    };
  }
}
