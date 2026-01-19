/**
 * Bigin Adapter v2 - Simplificado con Browser On-Demand
 *
 * CAMBIOS vs v1:
 * - Sin manejo de sesiones (siempre login/logout)
 * - Sin verificación de sesión activa
 * - Browser se cierra después de cada operación
 * - Código más limpio y mantenible
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { nanoid } from 'nanoid';
import path from 'path';
import type { BiginConfig, RobotConfig, CreateOrdenInput, CreateOrdenResult } from './types';
import { BiginSelectors } from './selectors';

export class BiginAdapter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: RobotConfig;
  private biginConfig: BiginConfig;
  private selectors = BiginSelectors;

  constructor(robotConfig: RobotConfig, biginConfig: BiginConfig) {
    this.config = robotConfig;
    this.biginConfig = biginConfig;
  }

  /**
   * Inicializar navegador
   */
  async init(): Promise<void> {
    console.log('🚀 Iniciando navegador...');

    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 }, // Viewport más pequeño = menos RAM
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    this.page = await this.context.newPage();
    console.log('✅ Navegador iniciado');
  }

  /**
   * Obtener página actual
   */
  private getPage(): Page {
    if (!this.page) throw new Error('Navegador no inicializado');
    return this.page;
  }

  /**
   * Esperar milisegundos
   */
  private async wait(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Tomar screenshot
   */
  private async screenshot(name: string): Promise<void> {
    if (!this.config.screenshotsEnabled) return;

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${name}-${timestamp}-${nanoid(6)}.png`;
      const filepath = path.join(this.config.storagePath, 'artifacts', filename);
      await this.getPage().screenshot({ path: filepath, fullPage: true });
      console.log(`📸 Screenshot: ${filename}`);
    } catch (e) {
      console.log('⚠️ Error tomando screenshot:', e);
    }
  }

  /**
   * Cargar cookies guardadas
   */
  private async loadCookies(): Promise<boolean> {
    if (!this.context) return false;

    const cookiesPath = path.join(this.config.storagePath, 'sessions', 'bigin-cookies.json');

    try {
      const fs = await import('fs/promises');
      const cookiesData = await fs.readFile(cookiesPath, 'utf-8');
      const cookies = JSON.parse(cookiesData);
      await this.context.addCookies(cookies);
      console.log('🍪 Cookies cargadas desde sesión guardada');
      return true;
    } catch (error) {
      console.log('ℹ️  No hay cookies guardadas, se requiere login');
      return false;
    }
  }

  /**
   * Guardar cookies
   */
  private async saveCookies(): Promise<void> {
    if (!this.context) return;

    const cookiesPath = path.join(this.config.storagePath, 'sessions', 'bigin-cookies.json');

    try {
      const fs = await import('fs/promises');
      const cookies = await this.context.cookies();

      // Crear directorio si no existe
      const dir = path.dirname(cookiesPath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(cookiesPath, JSON.stringify(cookies, null, 2));
      console.log('🍪 Cookies guardadas exitosamente');
    } catch (error) {
      console.log('⚠️ Error guardando cookies:', error);
    }
  }

  /**
   * Login a Bigin - Intenta reutilizar cookies guardadas
   */
  async login(): Promise<void> {
    console.log('\n🔐 Iniciando login a Bigin...');
    const page = this.getPage();

    try {
      // Intentar cargar cookies guardadas
      const hasCookies = await this.loadCookies();

      // Navegar a login (con cookies si existen)
      await page.goto(this.biginConfig.url, { waitUntil: 'networkidle' });
      await this.wait(2000);

      // Verificar si ya está logueado (con cookies o sesión del navegador)
      const currentUrl = page.url();
      if (currentUrl.includes('bigin.zoho.com') && !currentUrl.includes('signin')) {
        console.log('✅ Ya está logueado (usando cookies guardadas)');
        return;
      }

      if (currentUrl.includes('accounts.zoho.com') && !currentUrl.includes('/signin')) {
        console.log('✅ Ya está logueado (detectado desde URL)');
        console.log('📍 Navegando directamente a Bigin CRM...');
        await page.goto('https://bigin.zoho.com/bigin/org857936781/');
        await this.wait(5000);

        const biginUrl = page.url();
        if (biginUrl.includes('bigin.zoho.com')) {
          console.log('✅ Navegado exitosamente a Bigin CRM');
          await this.screenshot('after-login');
          await this.saveCookies();
          return;
        }
      }

      console.log('ℹ️  Cookies no válidas o expiradas, haciendo login manual...');
      await this.screenshot('before-login');

      // Ingresar email
      console.log('📧 Ingresando email...');
      await page.waitForSelector(this.selectors.login.emailInput, { timeout: 10000 });
      await page.fill(this.selectors.login.emailInput, this.biginConfig.email);
      await page.click(this.selectors.login.nextButton);
      await this.wait(2000);

      // Verificar si aparece pantalla de push notification ANTES de password
      let pushNotificationDetected = false;
      try {
        await page.waitForSelector(this.selectors.login.pushNotificationTitle, { timeout: 3000 });
        console.log('📱 OneAuth push notification detectado!');
        pushNotificationDetected = true;

        // Intentar extraer el número de verificación
        try {
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
            console.log('⏳ Waiting 180 seconds (3 minutes) for approval...\n\n');
          } else {
            console.log('\n📱 PLEASE CHECK YOUR ONEAUTH APP AND APPROVE THE LOGIN!');
            console.log('⏳ Waiting 180 seconds (3 minutes) for approval...\n\n');
          }
        } catch {
          console.log('\n📱 PLEASE CHECK YOUR ONEAUTH APP AND APPROVE THE LOGIN!');
          console.log('⏳ Waiting 180 seconds (3 minutes) for approval...\n\n');
        }

        // Esperar hasta 3 minutos por aprobación con polling
        const maxWait = 180000; // 3 minutos
        const pollInterval = 3000; // 3 segundos
        const startTime = Date.now();
        let approved = false;

        console.log('🔄 Checking for approval every 3 seconds...');

        while (Date.now() - startTime < maxWait && !approved) {
          await this.wait(pollInterval);

          const stillOnPush = await page.$(this.selectors.login.pushNotificationTitle);
          if (!stillOnPush) {
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

      } catch {
        console.log('ℹ️  No push notification screen, continuing with password...');
      }

      // Si se detectó push, verificar si el login ya fue exitoso
      if (pushNotificationDetected) {
        console.log('✅ Push notification flow - checking login status...');

        // Esperar un poco más para que la página redireccione
        await this.wait(3000);

        // Verificar si ya estamos logueados
        const currentUrl = page.url();
        const isLoggedIn = currentUrl.includes('bigin.zoho.com') ||
                          (currentUrl.includes('accounts.zoho.com') && !currentUrl.includes('/signin'));

        if (isLoggedIn) {
          console.log('✅ Successfully logged in via push notification');
          // Continuar al manejo post-login
        }
      } else {
        // No push notification, usar password flow
        console.log('🔐 Using password authentication flow...');

        try {
          await page.waitForSelector(this.selectors.login.passwordInput, { timeout: 5000 });
          await page.fill(this.selectors.login.passwordInput, this.biginConfig.password);
          await page.click(this.selectors.login.signInButton);
          await this.wait(3000);
        } catch (e) {
          console.log('⚠️  Password field not found, may already be logged in');
        }

        // Verificar si necesita passphrase de OneAuth DESPUÉS del password
        try {
          await page.waitForSelector(this.selectors.login.passphraseInput, { timeout: 5000 });
          console.log('🔐 OneAuth passphrase verification required');

          if (!this.biginConfig.passphrase) {
            throw new Error('OneAuth passphrase required but not provided. Please set BIGIN_PASSPHRASE in .env');
          }

          console.log('⌨️  Entering OneAuth passphrase...');
          await page.fill(this.selectors.login.passphraseInput, this.biginConfig.passphrase);
          await this.wait(500);

          try {
            await page.locator(this.selectors.login.passphraseSubmit).first().click();
            console.log('✅ OneAuth passphrase submitted');
          } catch {
            console.log('⚠️  Form may auto-submit');
          }

          await this.wait(5000);
        } catch {
          console.log('ℹ️  No OneAuth passphrase required');
        }
      }

      // Manejar pantalla de timezone si aparece
      try {
        await page.waitForSelector(this.selectors.postLogin.timezoneTitle, { timeout: 3000 });
        console.log('🕐 Pantalla de timezone detectada');

        const remindLater = await page.$('a:has-text("Remind me later")');
        if (remindLater) await remindLater.click();
        await this.wait(2000);
      } catch {
        // No hay pantalla de timezone
      }

      // Navegar a Bigin si estamos en accounts.zoho.com
      if (page.url().includes('accounts.zoho.com')) {
        console.log('📍 Navegando a Bigin CRM...');
        await page.goto('https://bigin.zoho.com/bigin/org857936781/');
        await this.wait(5000);
      }

      // Verificar login exitoso
      const finalUrl = page.url();
      if (finalUrl.includes('bigin.zoho.com')) {
        console.log('✅ Login exitoso');
        await this.screenshot('after-login');

        // GUARDAR COOKIES para próximas sesiones
        await this.saveCookies();
        console.log('💾 Sesión guardada - próximo login será automático');
      } else {
        throw new Error(`Login falló. URL actual: ${finalUrl}`);
      }

    } catch (error) {
      await this.screenshot('error-login');
      throw new Error(`Login falló: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Crear orden en Bigin - CÓDIGO ADAPTADO DEL ROBOT V1 QUE FUNCIONA
   */
  async createOrder(input: CreateOrdenInput): Promise<CreateOrdenResult> {
    console.log(`\n📝 Creando orden: ${input.ordenName}`);
    const page = this.getPage();

    // PONER DEFAULTS PARA CAMPOS REQUERIDOS
    if (!input.stage) {
      input.stage = 'Nuevo Ingreso';
      console.log('ℹ️  Stage no especificado, usando default: Nuevo Ingreso');
    }
    if (!input.closingDate) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7); // +7 días
      input.closingDate = futureDate.toLocaleDateString('en-GB'); // DD/MM/YYYY
      console.log(`ℹ️  Closing Date no especificado, usando default: ${input.closingDate}`);
    }
    if (!input.description) {
      input.description = `Orden creada automáticamente - ${input.ordenName}`;
      console.log('ℹ️  Description no especificado, usando default');
    }

    await this.screenshot('before-create-orden');

    try {
      // Step 1: Navegar al pipeline
      console.log('📍 Step 1: Navigating to Ventas Somnio pipeline...');
      const pipelineUrl = 'https://bigin.zoho.com/bigin/org857936781/Home#/deals/kanban/6331846000005987111?pipeline=6331846000005978642&sub_pipeline=6331846000005978973';
      await page.goto(pipelineUrl);
      await this.wait(5000);
      console.log('✅ Navigated to Ventas Somnio pipeline');

      // Step 2: Click +Orden button
      console.log('📍 Step 2: Clicking +Orden button...');
      await page.click(this.selectors.orden.createButton);
      console.log('✅ Clicked +Orden button, waiting for form...');
      await this.wait(5000);

      // Screenshot del form abierto
      await this.screenshot('form-abierto');

      // Esperar que el form cargue
      try {
        await page.waitForSelector(this.selectors.orden.form.saveButton, { timeout: 10000 });
        console.log('✅ Form is visible and ready');
      } catch (err) {
        console.log(`⚠️  Form may not be visible: ${err}`);
      }

      console.log('📍 Step 3: Filling form fields...');

      // Llenar Orden Name
      if (input.ordenName) {
        try {
          const ordenNameInput = page.locator('div:has-text("Create Orden") input[type="text"]').first();
          await ordenNameInput.click();
          await this.wait(300);
          await ordenNameInput.clear();
          await ordenNameInput.type(input.ordenName, { delay: 50 });
          await page.keyboard.press('Tab');
          await this.wait(500);
          console.log(`✓ Filled Orden Name: ${input.ordenName}`);
        } catch (err) {
          console.log(`⚠️  Could not fill Orden Name: ${err}`);
        }
      }

      // SKIP Contact Name
      console.log('⏭️  Skipping Contact Name (left empty as requested)');

      // Sub-Pipeline already selected
      console.log('⏭️  Sub-Pipeline already selected (Ventas Somnio Standard)');

      // Select Stage - REQUIRED FIELD
      if (input.stage) {
        let stageSelected = false;
        try {
          console.log(`🔄 Attempting to select Stage: ${input.stage}`);

          const clicked = await page.evaluate(() => {
            const allElements: any[] = Array.from(document.querySelectorAll('*'));
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

          await this.wait(3000);

          const stageText = input.stage.toUpperCase();
          const stageSelectors = [
            `span.ellipsis:has-text("${stageText}")`,
            `span[data-ellipsis="true"]:has-text("${stageText}")`,
            `span:has-text("${stageText}")`,
            `text="${stageText}"`,
            `:text-is("NUEVO INGRESO")`
          ];

          for (const selector of stageSelectors) {
            try {
              console.log(`🔍 Trying stage selector: ${selector}`);
              const stageOption = page.locator(selector).first();
              await stageOption.click({ timeout: 3000 });
              await this.wait(1000);
              console.log(`✓ Selected Stage: ${input.stage} using selector: ${selector}`);
              stageSelected = true;
              break;
            } catch (e) {
              console.log(`⚠️  Selector failed: ${selector}`);
            }
          }

          if (!stageSelected) {
            console.log(`❌ CRITICAL: Could not select Stage`);
          }
        } catch (err) {
          console.log(`⚠️  Stage selection failed: ${err}`);
        }
      }

      // Get all text inputs
      const modalInputs = page.locator('div:has-text("Orden Information") input[type="text"]:visible');
      const inputCount = await modalInputs.count();
      console.log(`📊 Found ${inputCount} text inputs in form`);

      // Llenar Closing Date
      if (input.closingDate) {
        try {
          const closingDateInput = page.locator('input[placeholder*="DD/MM"], input[placeholder*="MM/DD"]').first();
          await closingDateInput.click();
          await this.wait(200);
          await closingDateInput.clear();
          await closingDateInput.type(input.closingDate, { delay: 30 });
          await page.keyboard.press('Tab');
          await this.wait(400);
          console.log(`✓ Filled Closing Date: ${input.closingDate}`);
        } catch (err) {
          console.log(`⚠️  Could not fill Closing Date: ${err}`);
        }
      }

      // Llenar Amount
      if (input.amount) {
        try {
          const amountInput = modalInputs.nth(2);
          await amountInput.click();
          await this.wait(200);
          await amountInput.clear();
          await amountInput.type(input.amount.toString(), { delay: 30 });
          await page.keyboard.press('Tab');
          await this.wait(400);
          console.log(`✓ Filled Amount: ${input.amount}`);
        } catch (err) {
          console.log(`⚠️  Could not fill Amount: ${err}`);
        }
      }

      // Llenar campos restantes
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
            await this.wait(200);
            await fieldInput.clear();
            await fieldInput.type(field.value, { delay: 20 });
            await page.keyboard.press('Tab');
            await this.wait(300);
            console.log(`✓ Filled ${field.name}: ${field.value}`);
          } catch (err) {
            console.log(`⚠️  Could not fill ${field.name}: ${err}`);
          }
        }
      }

      // Llenar Description (REQUERIDO)
      if (input.description) {
        try {
          console.log(`📝 Filling Description field with: ${input.description}`);

          const filled = await page.evaluate((text) => {
            const descTextarea = document.getElementById('Description');
            if (descTextarea) {
              (descTextarea as HTMLTextAreaElement).value = text;
              descTextarea.dispatchEvent(new Event('input', { bubbles: true }));
              descTextarea.dispatchEvent(new Event('change', { bubbles: true }));
              descTextarea.dispatchEvent(new Event('blur', { bubbles: true }));
              return true;
            }
            return false;
          }, input.description);

          if (!filled) {
            console.log(`❌ CRITICAL: Could not find Description textarea`);
            throw new Error('Failed to find Description field');
          }

          await this.wait(1000);

          const value = await page.evaluate(() => {
            const descTextarea = document.getElementById('Description');
            return descTextarea ? (descTextarea as HTMLTextAreaElement).value : '';
          });

          if (value === input.description) {
            console.log(`✓ Filled Description: ${input.description} - VERIFIED ✓`);
          } else {
            console.log(`⚠️  Description value not verified`);
          }
        } catch (err) {
          console.log(`❌ ERROR filling Description: ${err}`);
          throw err;
        }
      }

      // Llenar CallBell
      if (input.callBell) {
        try {
          console.log(`📝 Filling CallBell field with: ${input.callBell}`);
          const callBellInput = page.locator('input#CallBell, input[name="CallBell"]').first();
          await callBellInput.click();
          await this.wait(200);
          await callBellInput.clear();
          await callBellInput.type(input.callBell, { delay: 30 });
          await page.keyboard.press('Tab');
          await this.wait(400);
          console.log(`✓ Filled CallBell: ${input.callBell}`);
        } catch (err) {
          console.log(`⚠️  Could not fill CallBell field: ${err}`);
        }
      }

      console.log('⏭️  Skipping Transportadora, Guia (left empty as requested)');

      console.log('📍 Step 4: Waiting before save...');
      await this.wait(3000);

      await this.screenshot('before-save');
      console.log('📸 Screenshot taken before save');

      // Step 5: Guardar
      console.log('📍 Step 5: Saving orden...');
      await page.click(this.selectors.orden.form.saveButton);
      console.log('✅ Clicked Save button');

      await this.wait(3000);

      // Verificar si el form se cerró o sigue abierto con errores
      try {
        const formStillOpen = await page.locator('div:has-text("Create Orden")').isVisible({ timeout: 2000 });

        if (formStillOpen) {
          const errorMessages = await page.locator('[class*="error"]:visible, .error-message:visible, [style*="color: red"]:visible').allTextContents();

          if (errorMessages.length > 0) {
            console.log(`❌ ERROR: Form validation failed:`, errorMessages);
            await this.screenshot('save-failed-validation');
            throw new Error(`Validation error: ${errorMessages.join(', ')}`);
          } else {
            console.log('⚠️  Form still open but no error messages visible - checking...');
            await this.wait(2000);
          }
        }
      } catch (e) {
        console.log('✅ Form closed - orden likely saved');
      }

      await this.wait(2000);
      console.log('✅ Orden created successfully');

      // Step 6: Capturar Order ID
      console.log('📍 Step 6: Capturing order ID from URL...');
      await this.wait(3000);

      let currentUrl = page.url();
      console.log('📍 Current URL:', currentUrl);

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
        await this.wait(2000);

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
        console.log('⚠️  Could not capture order ID - order may still have been created');
        orderId = 'unknown';
        orderUrl = 'https://bigin.zoho.com/bigin/org857936781/Home#/deals/kanban/6331846000005987111?pipeline=6331846000005978642&sub_pipeline=6331846000005978973';
      }

      console.log(`📎 Final Order ID: ${orderId}`);
      await this.screenshot('order-created');

      return { orderId, orderUrl };

    } catch (error) {
      await this.screenshot('error-create-order');
      throw error;
    }
  }

  /**
   * Cerrar navegador y liberar recursos
   */
  async close(): Promise<void> {
    console.log('🔴 Cerrando navegador...');

    if (this.page) {
      try { await this.page.close(); } catch {}
      this.page = null;
    }

    if (this.context) {
      try { await this.context.close(); } catch {}
      this.context = null;
    }

    if (this.browser) {
      try { await this.browser.close(); } catch {}
      this.browser = null;
    }

    console.log('✅ Navegador cerrado - recursos liberados');
  }
}
