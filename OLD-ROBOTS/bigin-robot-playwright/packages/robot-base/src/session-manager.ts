/**
 * Session Manager - Handle login sessions and cookies
 */

import path from 'path';
import type { SessionInfo, RobotConfig } from './types';
import type { PlaywrightEngine } from './playwright-engine';

export class SessionManager {
  private config: RobotConfig;
  private engine: PlaywrightEngine;
  private sessions: Map<string, SessionInfo> = new Map();

  constructor(engine: PlaywrightEngine, config: RobotConfig) {
    this.engine = engine;
    this.config = config;
  }

  /**
   * Check if session exists and is valid
   */
  async hasValidSession(platform: string): Promise<boolean> {
    const session = this.sessions.get(platform);

    if (!session || !session.isLoggedIn) {
      return false;
    }

    if (session.expiresAt && session.expiresAt < new Date()) {
      console.log(`⚠️  Session for ${platform} expired`);
      return false;
    }

    return true;
  }

  /**
   * Load session from cookies
   */
  async loadSession(platform: string): Promise<boolean> {
    const cookiesPath = this.getCookiesPath(platform);

    try {
      await this.engine.loadCookies(cookiesPath);

      const session: SessionInfo = {
        platform,
        isLoggedIn: true,
        cookiesPath,
        lastActivity: new Date(),
        expiresAt: this.calculateExpiry()
      };

      this.sessions.set(platform, session);
      console.log(`✅ Session loaded for ${platform}`);
      return true;
    } catch (error) {
      console.log(`⚠️  No saved session for ${platform}`);
      return false;
    }
  }

  /**
   * Save session cookies
   */
  async saveSession(platform: string): Promise<void> {
    const cookiesPath = this.getCookiesPath(platform);
    await this.engine.saveCookies(cookiesPath);

    const session: SessionInfo = {
      platform,
      isLoggedIn: true,
      cookiesPath,
      lastActivity: new Date(),
      expiresAt: this.calculateExpiry()
    };

    this.sessions.set(platform, session);
    console.log(`✅ Session saved for ${platform}`);
  }

  /**
   * Mark session as logged in
   */
  markLoggedIn(platform: string): void {
    const session = this.sessions.get(platform) || {
      platform,
      isLoggedIn: true,
      lastActivity: new Date()
    };

    session.isLoggedIn = true;
    session.lastActivity = new Date();
    this.sessions.set(platform, session);
  }

  /**
   * Clear session
   */
  clearSession(platform: string): void {
    this.sessions.delete(platform);
    console.log(`🗑️  Session cleared for ${platform}`);
  }

  /**
   * Get session info
   */
  getSession(platform: string): SessionInfo | undefined {
    return this.sessions.get(platform);
  }

  /**
   * Get cookies file path for platform
   */
  private getCookiesPath(platform: string): string {
    return path.join(this.config.storagePath, 'sessions', `${platform}-cookies.json`);
  }

  /**
   * Calculate session expiry (30 minutes for Bigin)
   */
  private calculateExpiry(): Date {
    const now = new Date();
    // 30 minutes = 30 * 60 * 1000 milliseconds
    return new Date(now.getTime() + 30 * 60 * 1000);
  }

  /**
   * Check if session is about to expire (within 5 minutes)
   */
  isSessionExpiringSoon(platform: string): boolean {
    const session = this.sessions.get(platform);

    if (!session || !session.expiresAt) {
      return true; // Consider expired if no session info
    }

    const now = new Date();
    const timeUntilExpiry = session.expiresAt.getTime() - now.getTime();
    const fiveMinutes = 5 * 60 * 1000;

    return timeUntilExpiry < fiveMinutes;
  }

  /**
   * Refresh session expiry time
   */
  refreshSession(platform: string): void {
    const session = this.sessions.get(platform);

    if (session) {
      session.lastActivity = new Date();
      session.expiresAt = this.calculateExpiry();
      this.sessions.set(platform, session);
      console.log(`🔄 Session refreshed for ${platform}`);
    }
  }
}
