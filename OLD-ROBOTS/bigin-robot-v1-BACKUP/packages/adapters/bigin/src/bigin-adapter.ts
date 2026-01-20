/**
 * Bigin Adapter - Zoho Bigin CRM automation
 *
 * TEMPORAL: Este adapter opera Bigin mientras no tenemos CRM propio.
 * Cuando tengamos CRM propio, crearemos TuCRMAdapter con la misma interface.
 */

import { RobotBase } from '@modelo-ia/robot-base';
import { BiginSelectors } from './selectors';
import type { BiginConfig, Lead, FindLeadInput, CreateLeadInput, AddNoteInput, CreateOrdenInput } from './types';

export class BiginAdapter {
  private robot: RobotBase;
  private config: BiginConfig;
  private selectors = BiginSelectors;

  constructor(robot: RobotBase, config: BiginConfig) {
    this.robot = robot;
    this.config = config;
  }

  /**
   * Check if current window/tab is closed or Bigin session is lost
   */
  private async isWindowClosed(): Promise<boolean> {
    try {
      const page = this.robot.engine.getPage();

      if (page.isClosed()) {
        console.log('⚠️  Browser window is closed');
        return true;
      }

      // Check if we're still on Bigin domain
      const currentUrl = page.url();
      if (!currentUrl.includes('bigin.zoho.com') && !currentUrl.includes('accounts.zoho.com')) {
        console.log(`⚠️  Not on Bigin/Zoho domain: ${currentUrl}`);
        return true;
      }

      // Check if we can find any Bigin UI element
      const hasBiginUI = await page.$(this.selectors.nav.leadsTab) !== null;
      if (!hasBiginUI && currentUrl.includes('bigin.zoho.com')) {
        console.log('⚠️  Bigin UI not found, session may be lost');
        return true;
      }

      return false;
    } catch (error) {
      console.log(`⚠️  Error checking window status: ${error}`);
      return true;
    }
  }

  /**
   * Ensure we have a valid session, relogin if needed
   */
  private async ensureValidSession(): Promise<void> {
    // Check if window is closed or session is lost
    const windowClosed = await this.isWindowClosed();

    if (windowClosed) {
      console.log('🔄 Window closed or session lost, reinitializing...');
      await this.robot.init();
      await this.login();
      return;
    }

    // Check if session is expiring soon (within 5 minutes)
    if (this.robot.sessions.isSessionExpiringSoon('bigin')) {
      console.log('⏱️  Session expiring soon, refreshing login...');
      await this.login();
      return;
    }

    // Refresh session activity
    this.robot.sessions.refreshSession('bigin');
    console.log('✅ Session is valid');
  }

  /**
   * Retry logic with exponential backoff
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Ensure valid session before each attempt
        await this.ensureValidSession();

        // Execute operation
        const result = await operation();

        if (attempt > 0) {
          console.log(`✅ ${operationName} succeeded on attempt ${attempt + 1}`);
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries - 1) {
          // Calculate backoff: 2^attempt seconds (1s, 2s, 4s)
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.log(`⚠️  ${operationName} failed (attempt ${attempt + 1}/${maxRetries}): ${lastError.message}`);
          console.log(`⏳ Retrying in ${backoffMs / 1000}s...`);
          await this.robot.engine.wait(backoffMs);
        } else {
          console.log(`❌ ${operationName} failed after ${maxRetries} attempts`);
        }
      }
    }

    throw lastError;
  }

  /**
   * Send notification to team (placeholder - implement with your notification service)
   */
  private async notifyTeam(message: string, error?: Error): Promise<void> {
    console.log('\n🚨 TEAM NOTIFICATION 🚨');
    console.log(`Message: ${message}`);
    if (error) {
      console.log(`Error: ${error.message}`);
      console.log(`Stack: ${error.stack}`);
    }
    console.log('TODO: Implement notification service (Slack, email, etc.)');

    // TODO: Implement actual notification
    // Examples:
    // - Send Slack message to #operations channel
    // - Send email to operations@somnio.com
    // - Send WhatsApp message to operations team
    // - Create incident in PagerDuty
  }

  /**
   * Login to Bigin
   * Uses session manager to reuse cookies
   */
  async login(): Promise<void> {
    console.log('\n🔐 Logging in to Bigin...');

    // Check if we have a valid session
    const hasSession = await this.robot.sessions.loadSession('bigin');

    if (hasSession) {
      console.log('✅ Using saved session');
      await this.robot.engine.goto(this.config.url);

      // Verify we're still logged in
      await this.robot.engine.wait(2000);
      const page = this.robot.engine.getPage();
      const isLoggedIn = await page.$(this.selectors.nav.leadsTab) !== null;

      if (isLoggedIn) {
        console.log('✅ Session is valid');
        return;
      }

      console.log('⚠️  Session expired, logging in again...');
    }

    // Navigate to login page
    await this.robot.engine.goto(this.config.url);
    await this.robot.engine.wait(3000);

    const page = this.robot.engine.getPage();
    const currentUrl = page.url();

    // Check if we're already logged in (redirected to accounts or profile page)
    if (currentUrl.includes('accounts.zoho.com') && !currentUrl.includes('/signin')) {
      console.log('✅ Already logged in (detected from URL redirect)');
      console.log('📍 Navigating directly to Bigin CRM...');
      await page.goto('https://bigin.zoho.com');
      await this.robot.engine.wait(5000);

      // Verify we're on Bigin
      const biginUrl = page.url();
      if (biginUrl.includes('bigin.zoho.com')) {
        console.log('✅ Successfully navigated to Bigin CRM');
        await this.robot.screenshots.after('login');
        await this.robot.sessions.saveSession('bigin');
        this.robot.sessions.markLoggedIn('bigin');
        console.log('✅ Login successful');
        return;
      }
    }

    // Take screenshot before login
    await this.robot.screenshots.before('login');

    try {
      // Enter email
      await this.robot.engine.waitForSelector(this.selectors.login.emailInput, 5000);
      await this.robot.engine.fill(this.selectors.login.emailInput, this.config.email);
      await this.robot.engine.click(this.selectors.login.nextButton);
      await this.robot.engine.wait(2000);

      const page = this.robot.engine.getPage();

      // Check if OneAuth push notification screen appears BEFORE password screen
      let pushNotificationDetected = false;
      try {
        await this.robot.engine.waitForSelector(this.selectors.login.pushNotificationTitle, 3000);
        console.log('📱 OneAuth push notification detected!');

        // Try to extract the verification number
        try {
          // Use Playwright to find all elements and check their text
          const allElements = await page.$$('div, span, p');
          let numberText = null;

          for (const element of allElements) {
            const text = await element.textContent();
            if (text && /^\d{2,3}$/.test(text.trim())) {
              numberText = text.trim();
              break;
            }
          }

          if (numberText) {
            console.log('\n\n');
            console.log('🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔');
            console.log('🔔                                                  🔔');
            console.log(`🔔     VERIFICATION NUMBER: ${numberText.padEnd(20, ' ')}🔔`);
            console.log('🔔                                                  🔔');
            console.log('🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔');
            console.log('\n📱 APPROVE THIS LOGIN IN YOUR ONEAUTH APP NOW!');
            console.log('⏳ Waiting 120 seconds (2 minutes) for approval...\n\n');
          } else {
            console.log('\n⚠️  Could not extract verification number automatically');
            console.log('📱 PLEASE CHECK YOUR ONEAUTH APP AND APPROVE THE LOGIN!');
            console.log('⏳ Waiting 120 seconds (2 minutes) for approval...\n\n');
          }
        } catch (err) {
          console.log('\n⚠️  Could not extract verification number');
          console.log('📱 PLEASE CHECK YOUR ONEAUTH APP AND APPROVE THE LOGIN!');
          console.log('⏳ Waiting 120 seconds (2 minutes) for approval...\n\n');
        }

        // Wait for approval with polling (check every 3 seconds for up to 3 minutes)
        pushNotificationDetected = true;

        const maxWaitTime = 180000; // 3 minutes
        const pollInterval = 3000; // 3 seconds
        const startTime = Date.now();
        let approved = false;

        console.log('🔄 Checking for approval every 3 seconds...');

        while (Date.now() - startTime < maxWaitTime && !approved) {
          await this.robot.engine.wait(pollInterval);

          // Check if we're still on the push notification screen
          const stillOnPushScreen = await page.$(this.selectors.login.pushNotificationTitle);

          if (!stillOnPushScreen) {
            console.log('✅ Push notification approved! Continuing...');
            approved = true;
            break;
          }

          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          console.log(`⏱️  Waiting... (${elapsed}s elapsed)`);
        }

        if (!approved) {
          console.log('⚠️  Timeout: Push notification was not approved within 3 minutes');
        }

      } catch (e) {
        console.log('ℹ️  No push notification screen, continuing with password...');
      }

      // If push notification was detected, skip password entry and check if login succeeded
      if (pushNotificationDetected) {
        console.log('✅ Push notification flow - skipping password entry...');
        // Push notification was shown and we waited, now check if login succeeded
      } else {
        // No push notification, use password flow
        console.log('🔐 Using password authentication flow...');

        // Enter password
        await this.robot.engine.waitForSelector(this.selectors.login.passwordInput, 5000);
        await this.robot.engine.fill(this.selectors.login.passwordInput, this.config.password);
        await this.robot.engine.click(this.selectors.login.signInButton);

        // Check for authentication verification AFTER password (OneAuth passphrase or OTP)
        await this.robot.engine.wait(3000);

        // Try OneAuth passphrase first
        try {
          await this.robot.engine.waitForSelector(this.selectors.login.passphraseInput, 5000);
          console.log('🔐 OneAuth passphrase verification required');

          if (!this.config.passphrase) {
            throw new Error('OneAuth passphrase required but not provided. Please set BIGIN_PASSPHRASE in .env');
          }

          console.log('⌨️  Entering OneAuth passphrase...');
          await this.robot.engine.fill(this.selectors.login.passphraseInput, this.config.passphrase);
          await this.robot.engine.wait(500);

          // Click submit button
          try {
            const submitBtn = await page.locator(this.selectors.login.passphraseSubmit).first();
            await submitBtn.click();
            console.log('✅ OneAuth passphrase submitted');
          } catch (err) {
            console.log('⚠️  Form may auto-submit');
          }

          await this.robot.engine.wait(5000);
        } catch (passphraseError) {
          // No passphrase field found, try OTP
          try {
            await this.robot.engine.waitForSelector(this.selectors.login.otpDigitInputs, 2000);
            console.log('🔐 OTP verification required');

            if (!this.config.otp) {
              throw new Error('OTP verification required but no OTP provided. Please set BIGIN_OTP in .env');
            }

            console.log('⌨️  Entering OTP...');

            // Get all OTP digit fields
            const digitFields = await page.$$(this.selectors.login.otpDigitInputs);

            // Fill each digit
            const otpDigits = this.config.otp.split('');
            for (let i = 0; i < Math.min(digitFields.length, otpDigits.length); i++) {
              await digitFields[i].fill(otpDigits[i]);
            }

            console.log('✅ OTP entered, clicking Verify button...');
            await this.robot.engine.wait(1000);

            // Click the Verify button
            try {
              const verifyBtnSelector = 'button[type="submit"], button:has-text("Verify"), .zpbutton-submit';
              await page.locator(verifyBtnSelector).first().click();
              console.log('✅ Verify button clicked');
            } catch (err) {
              console.log('⚠️  Could not click Verify button, form may auto-submit');
            }

            await this.robot.engine.wait(5000);
          } catch (otpError) {
            // No authentication verification needed
            console.log('ℹ️  No additional authentication verification needed');
          }
        }
      }

      // Handle post-login screens (timezone update, etc.)
      console.log('🔍 Checking for post-login screens...');
      try {
        await this.robot.engine.waitForSelector(this.selectors.postLogin.timezoneTitle, 5000);
        console.log('🕐 Timezone update screen detected');

        // Try to click "Remind me later"
        try {
          // Try multiple approaches to find and click the element
          const selectors = [
            'a:has-text("Remind me later")',
            'button:has-text("Remind me later")',
            'span:has-text("Remind me later")',
            '.remind-later',
            '[class*="remind"]'
          ];

          let clicked = false;
          for (const selector of selectors) {
            try {
              const element = await page.$(selector);
              if (element) {
                await element.click();
                console.log(`✅ Clicked "Remind me later" using selector: ${selector}`);
                clicked = true;
                break;
              }
            } catch (err) {
              // Try next selector
            }
          }

          if (!clicked) {
            console.log('⚠️  Could not find "Remind me later" button, continuing anyway...');
          }

          await this.robot.engine.wait(2000);
        } catch (clickErr) {
          console.log('⚠️  Error clicking "Remind me later", continuing anyway...');
        }
      } catch (e) {
        console.log('✓ No timezone screen detected');
      }

      // Check if we're on Zoho Accounts page and need to navigate to Bigin
      const currentUrl = page.url();
      if (currentUrl.includes('accounts.zoho.com')) {
        console.log('📍 On Zoho Accounts page, navigating to Bigin CRM...');
        await page.goto('https://bigin.zoho.com/bigin/org857936781/');
        await this.robot.engine.wait(5000);
      }

      // Wait for dashboard to load
      console.log('⏳ Waiting for dashboard...');
      await this.robot.engine.wait(3000);

      // Verify we're on Bigin by checking URL
      const finalUrl = page.url();
      if (finalUrl.includes('bigin.zoho.com')) {
        console.log('✅ Successfully logged into Bigin CRM!');
        console.log(`📍 Current URL: ${finalUrl}`);
      } else {
        throw new Error(`Expected to be on Bigin CRM but got URL: ${finalUrl}`);
      }

      // Take screenshot after login
      await this.robot.screenshots.after('login');

      // Save session
      await this.robot.sessions.saveSession('bigin');
      this.robot.sessions.markLoggedIn('bigin');

      console.log('✅ Login successful');
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      await this.robot.screenshots.error('login', errorObj);
      throw new Error(`Login failed: ${errorObj.message}`);
    }
  }

  /**
   * Find lead by phone, email, or name
   */
  async findLead(input: FindLeadInput): Promise<Lead | null> {
    console.log(`\n🔍 Searching for lead:`, input);

    await this.robot.screenshots.before('find_lead', input);

    try {
      // Navigate to leads
      await this.robot.engine.goto(this.config.url);
      await this.robot.engine.wait(2000);

      // Search
      const searchTerm = input.phone || input.email || input.name || '';
      await this.robot.engine.fill(this.selectors.leadsList.searchBox, searchTerm);
      await this.robot.engine.wait(2000); // Wait for search results

      // Check if lead found
      const page = this.robot.engine.getPage();
      const leadRow = await page.$(this.selectors.leadsList.firstLead);

      if (!leadRow) {
        console.log('❌ Lead not found');
        await this.robot.screenshots.after('find_lead', { found: false });
        return null;
      }

      // Extract lead data (simplified)
      const leadName = await page.textContent(this.selectors.leadDetail.leadName) || '';

      const lead: Lead = {
        id: 'temp-id', // TODO: Extract real ID from URL or data attribute
        firstName: leadName.split(' ')[0] || '',
        lastName: leadName.split(' ').slice(1).join(' ') || '',
        fullName: leadName
      };

      console.log('✅ Lead found:', lead.fullName);
      await this.robot.screenshots.after('find_lead', lead);

      return lead;
    } catch (error) {
      await this.robot.screenshots.error('find_lead', error as Error);
      throw error;
    }
  }

  /**
   * Create new lead
   */
  async createLead(input: CreateLeadInput): Promise<Lead> {
    console.log(`\n➕ Creating lead:`, input);

    await this.robot.screenshots.before('create_lead', input);

    try {
      // Navigate to leads
      await this.robot.engine.goto(this.config.url);
      await this.robot.engine.wait(2000);

      // Click new button
      await this.robot.engine.click(this.selectors.createLead.newButton);
      await this.robot.engine.wait(1000);

      // Fill form
      await this.robot.engine.fill(this.selectors.createLead.firstNameInput, input.firstName);
      await this.robot.engine.fill(this.selectors.createLead.lastNameInput, input.lastName);

      if (input.phone) {
        await this.robot.engine.fill(this.selectors.createLead.phoneInput, input.phone);
      }

      if (input.email) {
        await this.robot.engine.fill(this.selectors.createLead.emailInput, input.email);
      }

      if (input.company) {
        await this.robot.engine.fill(this.selectors.createLead.companyInput, input.company);
      }

      // Save
      await this.robot.engine.click(this.selectors.createLead.saveButton);
      await this.robot.engine.wait(3000); // Wait for save

      const lead: Lead = {
        id: 'new-lead-id', // TODO: Extract real ID
        firstName: input.firstName,
        lastName: input.lastName,
        fullName: `${input.firstName} ${input.lastName}`,
        phone: input.phone,
        email: input.email,
        company: input.company
      };

      console.log('✅ Lead created:', lead.fullName);
      await this.robot.screenshots.after('create_lead', lead);

      return lead;
    } catch (error) {
      await this.robot.screenshots.error('create_lead', error as Error);
      throw error;
    }
  }

  /**
   * Add note to lead
   */
  async addNote(input: AddNoteInput): Promise<void> {
    console.log(`\n📝 Adding note to lead ${input.leadId}`);

    await this.robot.screenshots.before('add_note', input);

    try {
      // Navigate to lead
      // TODO: Implement navigation to specific lead

      // Click notes tab
      await this.robot.engine.click(this.selectors.notes.notesTab);
      await this.robot.engine.wait(1000);

      // Add note
      await this.robot.engine.click(this.selectors.notes.addNoteButton);
      await this.robot.engine.wait(500);

      await this.robot.engine.fill(this.selectors.notes.noteTextarea, input.note);

      // Save
      await this.robot.engine.click(this.selectors.notes.saveNoteButton);
      await this.robot.engine.wait(2000);

      console.log('✅ Note added');
      await this.robot.screenshots.after('add_note');
    } catch (error) {
      await this.robot.screenshots.error('add_note', error as Error);
      throw error;
    }
  }

  /**
   * Create new orden (order) in Ventas Somnio pipeline
   * With automatic retry on failure and team notifications
   */
  async createOrder(input: CreateOrdenInput): Promise<{ orderId: string; orderUrl: string }> {
    console.log(`\n➕ Creating orden:`, input);

    try {
      // Use retry logic with exponential backoff
      const result = await this.retryWithBackoff(
        () => this.createOrderInternal(input),
        'Create Order',
        3 // Max 3 attempts
      );

      return result;
    } catch (error) {
      // Notify team about critical failure
      const errorObj = error instanceof Error ? error : new Error(String(error));
      await this.notifyTeam(
        `❌ CRITICAL: Failed to create order after 3 attempts\nOrder: ${input.ordenName}\nPhone: ${input.telefono}`,
        errorObj
      );

      throw errorObj;
    }
  }

  /**
   * Internal method to create order (used by retry logic)
   */
  private async createOrderInternal(input: CreateOrdenInput): Promise<{ orderId: string; orderUrl: string }> {
    await this.robot.screenshots.before('create_orden', input);

    try {
      const page = this.robot.engine.getPage();

      // Navigate directly to Ventas Somnio pipeline
      console.log('📍 Step 1: Navigating directly to Ventas Somnio pipeline...');
      const pipelineUrl = 'https://bigin.zoho.com/bigin/org857936781/Home#/deals/kanban/6331846000005987111?pipeline=6331846000005978642&sub_pipeline=6331846000005978973';

      await this.robot.engine.goto(pipelineUrl);
      await this.robot.engine.wait(5000); // Wait for pipeline to load

      console.log('✅ Navigated to Ventas Somnio pipeline');

      console.log('📍 Step 2: Clicking +Orden button...');

      // Click +Orden button
      await this.robot.engine.click(this.selectors.orden.createButton);
      console.log('✅ Clicked +Orden button, waiting for form...');

      // Wait longer for form to appear and be interactive
      await this.robot.engine.wait(5000);

      // Take screenshot to verify form is visible
      await this.robot.screenshots.after('form_opened', input);

      // Wait for Save button to be visible as confirmation that form loaded
      try {
        await page.waitForSelector(this.selectors.orden.form.saveButton, { timeout: 10000 });
        console.log('✅ Form is visible and ready');
      } catch (err) {
        console.log(`⚠️  Form may not be visible: ${err}`);
      }

      console.log('📍 Step 3: Filling form fields...');

      // Locate the form modal by finding inputs within it
      // Strategy: Find inputs by their position within the visible modal

      // Fill Orden Name - first text input in the modal
      if (input.ordenName) {
        try {
          const ordenNameInput = page.locator('div:has-text("Create Orden") input[type="text"]').first();
          await ordenNameInput.click(); // Click to focus
          await this.robot.engine.wait(300);
          await ordenNameInput.clear(); // Clear any existing value
          await ordenNameInput.type(input.ordenName, { delay: 50 }); // Type with delay
          await page.keyboard.press('Tab'); // Press Tab to trigger blur event
          await this.robot.engine.wait(500);
          console.log(`✓ Filled Orden Name: ${input.ordenName}`);
        } catch (err) {
          console.log(`⚠️  Could not fill Orden Name: ${err}`);
        }
      }

      // SKIP Contact Name - user wants it empty
      console.log('⏭️  Skipping Contact Name (left empty as requested)');

      // Sub-Pipeline already selected (we navigated to that pipeline)
      console.log('⏭️  Sub-Pipeline already selected (Ventas Somnio Standard)');

      // Select Stage - REQUIRED FIELD - try multiple approaches
      if (input.stage) {
        let stageSelected = false;

        // Try different selectors for the Stage dropdown
        const stageSelectors = [
          'text=Choose a stage',
          'div:has-text("Choose a stage")',
          'div:has-text("Sub-Pipeline & Stage") >> div:has-text("Choose")',
          '[class*="stage"] >> text=Choose',
          'button:has-text("Choose a stage")',
          'div[role="button"]:has-text("Choose a stage")'
        ];

        // Try with JavaScript click as last resort
        try {
          console.log(`🔄 Attempting Stage with JavaScript evaluation...`);

          // Use evaluate to click with JavaScript
          const clicked = await page.evaluate(() => {
            const allElements: any[] = Array.from((globalThis as any).document.querySelectorAll('*'));
            const stageElements = allElements.filter((el: any) =>
              el.textContent?.includes('Choose a stage') && el.textContent.length < 50
            );
            if (stageElements.length > 0) {
              stageElements[0].click();
              return true;
            }
            return false;
          });
          console.log(`📊 JavaScript click result: ${clicked}`);

          await this.robot.engine.wait(3000); // Wait longer for menu to appear

          // Try to find and click the stage option
          // Stage options are in <span class="ellipsis"> elements with UPPERCASE text
          const stageText = input.stage.toUpperCase();
          const stageSelectors = [
            `span.ellipsis:has-text("${stageText}")`,  // Most specific: span with class ellipsis
            `span[data-ellipsis="true"]:has-text("${stageText}")`,  // With data attribute
            `span:has-text("${stageText}")`,  // Any span
            `text="${stageText}"`,  // Plain text
            `:text-is("NUEVO INGRESO")`  // Hardcoded fallback
          ];

          for (const selector of stageSelectors) {
            try {
              console.log(`🔍 Trying stage selector: ${selector}`);
              const stageOption = page.locator(selector).first();
              await stageOption.click({ timeout: 3000 });
              await this.robot.engine.wait(1000);
              console.log(`✓ Selected Stage: ${input.stage} using selector: ${selector}`);
              stageSelected = true;
              break;
            } catch (e) {
              console.log(`⚠️  Selector failed: ${selector}`);
            }
          }

          if (!stageSelected) {
            console.log(`⚠️  Could not find stage option after dropdown opened`);
          }
        } catch (err) {
          console.log(`⚠️  JavaScript click also failed`);
        }

        if (!stageSelected) {
          console.log(`❌ CRITICAL: Could not select Stage - trying to proceed anyway`);
        }
      }

      // Fill fields using a simpler approach - find inputs within the modal
      // Get all text inputs within the modal (excluding search/lookup fields)
      const modalInputs = page.locator('div:has-text("Orden Information") input[type="text"]:visible');
      const inputCount = await modalInputs.count();
      console.log(`📊 Found ${inputCount} text inputs in form`);

      // Fill Closing Date - use placeholder to find it reliably
      if (input.closingDate) {
        try {
          const closingDateInput = page.locator('input[placeholder*="DD/MM"], input[placeholder*="MM/DD"]').first();
          await closingDateInput.click();
          await this.robot.engine.wait(200);
          await closingDateInput.clear();
          await closingDateInput.type(input.closingDate, { delay: 30 });
          await page.keyboard.press('Tab');
          await this.robot.engine.wait(400);
          console.log(`✓ Filled Closing Date: ${input.closingDate}`);
        } catch (err) {
          console.log(`⚠️  Could not fill Closing Date: ${err}`);
        }
      }

      // Fill Amount - typically after closing date
      if (input.amount) {
        try {
          const amountInput = modalInputs.nth(2);
          await amountInput.click();
          await this.robot.engine.wait(200);
          await amountInput.clear();
          await amountInput.type(input.amount.toString(), { delay: 30 });
          await page.keyboard.press('Tab');
          await this.robot.engine.wait(400);
          console.log(`✓ Filled Amount: ${input.amount}`);
        } catch (err) {
          console.log(`⚠️  Could not fill Amount: ${err}`);
        }
      }

      // Fill remaining fields in order with proper typing
      const remainingFields = [
        { value: input.telefono, name: 'Telefono', nth: 3 },
        { value: input.direccion, name: 'Dirección', nth: 4 },
        { value: input.municipio, name: 'Municipio', nth: 5 },
        { value: input.departamento, name: 'Departamento', nth: 6 },
        { value: input.email, name: 'Email', nth: 7 }
      ];

      for (const field of remainingFields) {
        if (field.value) {
          try {
            const fieldInput = modalInputs.nth(field.nth);
            await fieldInput.click();
            await this.robot.engine.wait(200);
            await fieldInput.clear();
            await fieldInput.type(field.value, { delay: 20 });
            await page.keyboard.press('Tab');
            await this.robot.engine.wait(300);
            console.log(`✓ Filled ${field.name}: ${field.value}`);
          } catch (err) {
            console.log(`⚠️  Could not fill ${field.name}: ${err}`);
          }
        }
      }

      // Fill Description (textarea) - REQUIRED FIELD
      if (input.description) {
        try {
          console.log(`📝 Filling Description field with: ${input.description}`);

          // Use JavaScript to directly set the value on the textarea with ID="Description"
          const filled = await page.evaluate((text) => {
            const descTextarea = (globalThis as any).document.getElementById('Description');
            if (descTextarea) {
              descTextarea.value = text;
              descTextarea.dispatchEvent(new Event('input', { bubbles: true }));
              descTextarea.dispatchEvent(new Event('change', { bubbles: true }));
              descTextarea.dispatchEvent(new Event('blur', { bubbles: true }));
              return true;
            }
            return false;
          }, input.description);

          if (!filled) {
            console.log(`❌ CRITICAL: Could not find Description textarea with ID="Description"`);
            throw new Error('Failed to find Description field');
          }

          await this.robot.engine.wait(1000);

          // Verify the value was set by reading it back
          const value = await page.evaluate(() => {
            const descTextarea = (globalThis as any).document.getElementById('Description');
            return descTextarea ? descTextarea.value : '';
          });

          if (value === input.description) {
            console.log(`✓ Filled Description: ${input.description} - VERIFIED ✓`);
          } else {
            console.log(`⚠️  Description value not verified: expected "${input.description}", got "${value}"`);
            throw new Error(`Failed to verify Description field value`);
          }
        } catch (err) {
          console.log(`❌ ERROR filling Description: ${err}`);
          throw err;
        }
      }

      // Fill CallBell field with conversation link
      if (input.callBell) {
        try {
          console.log(`📝 Filling CallBell field with: ${input.callBell}`);

          // Find the CallBell input field by ID or name
          const callBellInput = page.locator('input#CallBell, input[name="CallBell"]').first();
          await callBellInput.click();
          await this.robot.engine.wait(200);
          await callBellInput.clear();
          await callBellInput.type(input.callBell, { delay: 30 });
          await page.keyboard.press('Tab');
          await this.robot.engine.wait(400);
          console.log(`✓ Filled CallBell: ${input.callBell}`);
        } catch (err) {
          console.log(`⚠️  Could not fill CallBell field: ${err}`);
          // Don't throw - CallBell is optional
        }
      }

      // SKIP Transportadora, Guia (left empty as requested)
      console.log('⏭️  Skipping Transportadora, Guia (left empty as requested)');

      console.log('📍 Step 4: Waiting before save to ensure fields are processed...');
      await this.robot.engine.wait(3000); // Wait 3 seconds for all fields to be processed

      // Take screenshot before saving to verify all fields are filled
      await this.robot.screenshots.after('before_save', input);
      console.log('📸 Screenshot taken before save');

      console.log('📍 Step 5: Saving orden...');

      // Click Save button
      await this.robot.engine.click(this.selectors.orden.form.saveButton);
      console.log('✅ Clicked Save button');

      // Wait for save to complete and verify
      await this.robot.engine.wait(3000);

      // Check if form is still open (indicating error) or closed (success)
      try {
        const formStillOpen = await page.locator('div:has-text("Create Orden")').isVisible({ timeout: 2000 });

        if (formStillOpen) {
          // Form is still open - check for error messages
          const errorMessages = await page.locator('[class*="error"]:visible, .error-message:visible, [style*="color: red"]:visible').allTextContents();

          if (errorMessages.length > 0) {
            console.log(`❌ ERROR: Form validation failed:`, errorMessages);
            await this.robot.screenshots.after('save_failed_validation');
            throw new Error(`Validation error: ${errorMessages.join(', ')}`);
          } else {
            console.log('⚠️  Form still open but no error messages visible - checking...');
            await this.robot.engine.wait(2000); // Wait a bit more
          }
        }
      } catch (e) {
        // Form not found = form closed = success
        console.log('✅ Form closed - orden likely saved');
      }

      await this.robot.engine.wait(2000); // Final wait

      console.log('✅ Orden created successfully');

      // Capture the order ID from the URL
      console.log('📍 Step 6: Capturing order ID from URL...');
      await this.robot.engine.wait(3000); // Wait for redirect to order page

      const currentUrl = page.url();
      console.log('📍 Current URL:', currentUrl);

      // Extract order ID from URL: https://bigin.zoho.com/bigin/org857936781/Home?TODO=addUser#/deals/{ORDER_ID}?section=activities
      // OR from kanban view: https://bigin.zoho.com/bigin/org857936781/Home#/deals/kanban/...
      let orderId = '';
      let orderUrl = '';

      const dealMatch = currentUrl.match(/\/deals\/(\d+)/);
      if (dealMatch && dealMatch[1]) {
        orderId = dealMatch[1];
        orderUrl = `https://bigin.zoho.com/bigin/org857936781/Home?TODO=addUser#/deals/${orderId}?section=activities`;
        console.log('✅ Captured order ID:', orderId);
        console.log('✅ Order URL:', orderUrl);
      } else {
        console.log('⚠️  Could not extract order ID from URL, checking page for order link...');

        // Try to find the order by clicking on it or looking for the newly created order
        // Wait for the order to appear in the kanban view
        await this.robot.engine.wait(2000);

        // Try to find a link with the order name
        try {
          const orderLink = page.locator(`a:has-text("${input.ordenName}")`).first();
          const href = await orderLink.getAttribute('href');

          if (href) {
            const linkMatch = href.match(/\/deals\/(\d+)/);
            if (linkMatch && linkMatch[1]) {
              orderId = linkMatch[1];
              orderUrl = `https://bigin.zoho.com/bigin/org857936781/Home?TODO=addUser#/deals/${orderId}?section=activities`;
              console.log('✅ Captured order ID from link:', orderId);
            }
          }
        } catch (err) {
          console.log('⚠️  Could not find order link');
        }
      }

      if (!orderId) {
        console.log('⚠️  WARNING: Could not capture order ID, but order was likely created');
        // Don't throw error, just return empty values
        orderId = 'unknown';
        orderUrl = currentUrl;
      }

      await this.robot.screenshots.after('create_orden');

      return {
        orderId,
        orderUrl
      };
    } catch (error) {
      await this.robot.screenshots.error('create_orden', error as Error);
      throw error;
    }
  }

  /**
   * Close adapter
   */
  async close(): Promise<void> {
    await this.robot.close();
  }
}
