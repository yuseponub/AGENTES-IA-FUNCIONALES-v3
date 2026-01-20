/**
 * Robot Base - Main export
 */

export { PlaywrightEngine } from './playwright-engine';
export { ScreenshotCapture } from './screenshot-capture';
export { SessionManager } from './session-manager';
export * from './types';

import { PlaywrightEngine } from './playwright-engine';
import { ScreenshotCapture } from './screenshot-capture';
import { SessionManager } from './session-manager';
import type { RobotConfig } from './types';

/**
 * Robot Base - Main class
 */
export class RobotBase {
  public engine: PlaywrightEngine;
  public screenshots: ScreenshotCapture;
  public sessions: SessionManager;
  public config: RobotConfig;

  constructor(config: RobotConfig) {
    this.config = config;
    this.engine = new PlaywrightEngine(config);
    this.screenshots = new ScreenshotCapture(this.engine, config);
    this.sessions = new SessionManager(this.engine, config);
  }

  /**
   * Initialize robot
   */
  async init(): Promise<void> {
    await this.engine.init();
    console.log('✅ Robot Base initialized');
  }

  /**
   * Close robot
   */
  async close(): Promise<void> {
    await this.engine.close();
  }
}
