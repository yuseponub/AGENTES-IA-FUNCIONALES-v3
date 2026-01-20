/**
 * Playwright Engine - Core browser automation
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import type { RobotConfig } from './types';

export class PlaywrightEngine {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: RobotConfig;

  constructor(config: RobotConfig) {
    this.config = config;
  }

  /**
   * Initialize browser
   */
  async init(): Promise<void> {
    console.log('🚀 Initializing Playwright browser...');

    this.browser = await chromium.launch({
      headless: this.config.headless,
      slowMo: this.config.slowMo,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox'
      ]
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });

    this.page = await this.context.newPage();

    console.log('✅ Browser initialized');
  }

  /**
   * Get current page
   */
  getPage(): Page {
    if (!this.page) {
      throw new Error('Browser not initialized. Call init() first.');
    }
    return this.page;
  }

  /**
   * Navigate to URL
   */
  async goto(url: string, waitUntil: 'load' | 'networkidle' = 'networkidle'): Promise<void> {
    const page = this.getPage();
    console.log(`📍 Navigating to: ${url}`);
    await page.goto(url, { waitUntil });
  }

  /**
   * Wait for selector
   */
  async waitForSelector(selector: string, timeout: number = 10000): Promise<void> {
    const page = this.getPage();
    await page.waitForSelector(selector, { timeout });
  }

  /**
   * Click element
   */
  async click(selector: string): Promise<void> {
    const page = this.getPage();
    console.log(`🖱️  Clicking: ${selector}`);
    await page.click(selector);
  }

  /**
   * Fill input
   */
  async fill(selector: string, value: string): Promise<void> {
    const page = this.getPage();
    console.log(`⌨️  Filling ${selector}: ${value.substring(0, 20)}...`);
    await page.fill(selector, value);
  }

  /**
   * Get text content
   */
  async getText(selector: string): Promise<string | null> {
    const page = this.getPage();
    return await page.textContent(selector);
  }

  /**
   * Take screenshot
   */
  async screenshot(path: string, fullPage: boolean = false): Promise<void> {
    const page = this.getPage();
    await page.screenshot({ path, fullPage });
    console.log(`📸 Screenshot saved: ${path}`);
  }

  /**
   * Wait for timeout
   */
  async wait(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Load cookies from file
   */
  async loadCookies(path: string): Promise<void> {
    if (!this.context) throw new Error('Context not initialized');
    const fs = await import('fs/promises');
    try {
      const cookies = JSON.parse(await fs.readFile(path, 'utf-8'));
      await this.context.addCookies(cookies);
      console.log('🍪 Cookies loaded');
    } catch (error) {
      console.log('⚠️  No cookies found, will need to login');
    }
  }

  /**
   * Save cookies to file
   */
  async saveCookies(path: string): Promise<void> {
    if (!this.context) throw new Error('Context not initialized');
    const fs = await import('fs/promises');
    const cookies = await this.context.cookies();
    await fs.writeFile(path, JSON.stringify(cookies, null, 2));
    console.log('🍪 Cookies saved');
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      console.log('🔴 Browser closed');
    }
  }
}
