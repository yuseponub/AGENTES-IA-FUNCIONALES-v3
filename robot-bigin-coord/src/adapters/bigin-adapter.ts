import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { BiginConfig, BiginOrder } from '../types/index.js';

// Selectores de Bigin
const BiginSelectors = {
  login: {
    emailInput: '#login_id, input[name="LOGIN_ID"]',
    nextButton: '#nextbtn, button:has-text("Next")',
    passwordInput: '#password, input[name="PASSWORD"]',
    signInButton: '#nextbtn, button:has-text("Sign in")',
  },
  nav: {
    leadsTab: '[data-tab="Leads"], a:has-text("Leads")',
    dealsTab: '[data-tab="Deals"], a:has-text("Deals"), a:has-text("Ordenes")',
  },
  kanban: {
    // Cards en el kanban de un stage específico
    stageColumn: (stageName: string) => `[data-stage="${stageName}"], .kanban-column:has-text("${stageName}")`,
    orderCard: '.deal-card, .kanban-card, [data-entity="Deal"]',
    orderName: '.deal-name, .card-title, .entity-name',
    orderAmount: '.deal-amount, .card-amount',
  },
  orderDetail: {
    // Campos en el detalle de la orden
    telefono: '[data-field="Telefono"] .value, label:has-text("Telefono") ~ .value',
    direccion: '[data-field="Direccion"] .value, label:has-text("Direccion") ~ .value',
    municipio: '[data-field="Municipio"] .value, label:has-text("Municipio") ~ .value',
    departamento: '[data-field="Departamento"] .value, label:has-text("Departamento") ~ .value',
    email: '[data-field="Email"] .value, label:has-text("Email") ~ .value',
    description: '[data-field="Description"] .value, #Description',
    guiaInput: '[data-field="Guia"] input, label:has-text("Guia") ~ input',
    transportadoraInput: '[data-field="Transportadora"] input',
    stageDropdown: '.stage-dropdown, [data-field="Stage"]',
    saveButton: 'button:has-text("Save"), .save-btn',
    closeButton: '.close-detail, button:has-text("Close")',
  },
};

export class BiginAdapter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: BiginConfig;
  private cookiesPath: string;
  private isLoggedIn: boolean = false;

  constructor(config: BiginConfig) {
    this.config = config;
    this.cookiesPath = path.join(process.cwd(), 'storage/sessions/bigin-cookies.json');
  }

  async init(): Promise<void> {
    console.log('🚀 Iniciando browser para Bigin...');

    this.browser = await chromium.launch({
      headless: false,
      args: ['--start-maximized'],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    // Cargar cookies si existen
    if (fs.existsSync(this.cookiesPath)) {
      try {
        const cookies = JSON.parse(fs.readFileSync(this.cookiesPath, 'utf-8'));
        await this.context.addCookies(cookies);
        console.log('🍪 Cookies de Bigin cargadas');
      } catch (e) {
        console.log('⚠️ No se pudieron cargar cookies de Bigin');
      }
    }

    this.page = await this.context.newPage();
    console.log('✅ Browser iniciado para Bigin');
  }

  async login(): Promise<boolean> {
    if (!this.page) {
      await this.init();
    }

    console.log('🔐 Iniciando login en Bigin...');

    try {
      await this.page!.goto(this.config.url, { waitUntil: 'networkidle' });
      await this.page!.waitForTimeout(3000);

      // Verificar si ya estamos logueados
      const currentUrl = this.page!.url();
      if (currentUrl.includes('bigin.zoho.com') && !currentUrl.includes('signin')) {
        console.log('✅ Ya logueado en Bigin');
        this.isLoggedIn = true;
        return true;
      }

      // Llenar email
      console.log('📝 Llenando email...');
      await this.page!.waitForSelector(BiginSelectors.login.emailInput, { timeout: 10000 });
      await this.page!.fill(BiginSelectors.login.emailInput, this.config.email);
      await this.page!.waitForTimeout(500);

      // Click Next
      await this.page!.click(BiginSelectors.login.nextButton);
      await this.page!.waitForTimeout(2000);

      // Llenar contraseña
      console.log('📝 Llenando contraseña...');
      await this.page!.waitForSelector(BiginSelectors.login.passwordInput, { timeout: 10000 });
      await this.page!.fill(BiginSelectors.login.passwordInput, this.config.password);
      await this.page!.waitForTimeout(500);

      // Click Sign In
      await this.page!.click(BiginSelectors.login.signInButton);
      await this.page!.waitForTimeout(5000);

      // Manejar OneAuth si aparece
      if (this.config.passphrase) {
        const passphraseInput = await this.page!.$('input[placeholder*="passphrase"], input[type="password"]');
        if (passphraseInput) {
          console.log('🔑 Ingresando passphrase de OneAuth...');
          await passphraseInput.fill(this.config.passphrase);
          await this.page!.keyboard.press('Enter');
          await this.page!.waitForTimeout(5000);
        }
      }

      // Navegar a Bigin
      await this.page!.goto('https://bigin.zoho.com', { waitUntil: 'networkidle' });
      await this.page!.waitForTimeout(3000);

      // Verificar login
      if (this.page!.url().includes('bigin.zoho.com')) {
        console.log('✅ Login exitoso en Bigin');
        await this.saveCookies();
        this.isLoggedIn = true;
        return true;
      }

      console.log('❌ Login falló');
      return false;

    } catch (error) {
      console.error('❌ Error en login de Bigin:', error);
      return false;
    }
  }

  private async saveCookies(): Promise<void> {
    if (!this.context) return;

    try {
      const cookies = await this.context.cookies();
      fs.writeFileSync(this.cookiesPath, JSON.stringify(cookies, null, 2));
      console.log('🍪 Cookies de Bigin guardadas');
    } catch (e) {
      console.log('⚠️ No se pudieron guardar cookies');
    }
  }

  /**
   * Obtener órdenes de un pipeline y stage específico
   */
  async getOrdersByStage(pipeline: string, stage: string): Promise<BiginOrder[]> {
    if (!this.isLoggedIn) {
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        throw new Error('No se pudo iniciar sesión en Bigin');
      }
    }

    console.log(`📋 Obteniendo órdenes del pipeline "${pipeline}" en stage "${stage}"...`);

    const orders: BiginOrder[] = [];

    try {
      // Navegar al pipeline de kanban
      // URL pattern: https://bigin.zoho.com/bigin/org{ID}/Home#/deals/kanban/{pipelineId}
      // TODO: Ajustar la URL según el pipeline "logistica"
      const kanbanUrl = `https://bigin.zoho.com/bigin/org857936781/Home#/deals/kanban`;
      await this.page!.goto(kanbanUrl, { waitUntil: 'networkidle' });
      await this.page!.waitForTimeout(3000);

      // TODO: Seleccionar el sub-pipeline "logistica" si es necesario

      // Buscar la columna del stage
      const stageColumn = await this.page!.$(BiginSelectors.kanban.stageColumn(stage));
      if (!stageColumn) {
        console.log(`⚠️ No se encontró el stage "${stage}"`);
        return orders;
      }

      // Obtener todas las cards de órdenes en ese stage
      const orderCards = await stageColumn.$$(BiginSelectors.kanban.orderCard);
      console.log(`📦 Encontradas ${orderCards.length} órdenes en stage "${stage}"`);

      for (const card of orderCards) {
        // Click en la card para ver detalles
        await card.click();
        await this.page!.waitForTimeout(2000);

        // Extraer datos de la orden
        const order = await this.extractOrderDetails();
        if (order) {
          orders.push(order);
        }

        // Cerrar el detalle
        const closeBtn = await this.page!.$(BiginSelectors.orderDetail.closeButton);
        if (closeBtn) {
          await closeBtn.click();
          await this.page!.waitForTimeout(1000);
        }
      }

      console.log(`✅ Extraídas ${orders.length} órdenes`);
      return orders;

    } catch (error) {
      console.error('❌ Error obteniendo órdenes:', error);
      return orders;
    }
  }

  private async extractOrderDetails(): Promise<BiginOrder | null> {
    try {
      const url = this.page!.url();
      const orderIdMatch = url.match(/\/deals\/(\d+)/);
      const orderId = orderIdMatch ? orderIdMatch[1] : '';

      const getText = async (selector: string): Promise<string> => {
        const el = await this.page!.$(selector);
        return el ? (await el.textContent() || '').trim() : '';
      };

      const order: BiginOrder = {
        orderId,
        orderName: await getText(BiginSelectors.kanban.orderName),
        telefono: await getText(BiginSelectors.orderDetail.telefono),
        direccion: await getText(BiginSelectors.orderDetail.direccion),
        municipio: await getText(BiginSelectors.orderDetail.municipio),
        departamento: await getText(BiginSelectors.orderDetail.departamento),
        email: await getText(BiginSelectors.orderDetail.email),
        description: await getText(BiginSelectors.orderDetail.description),
        stage: '', // Se llenará después
      };

      return order;
    } catch (error) {
      console.error('Error extrayendo detalles:', error);
      return null;
    }
  }

  /**
   * Actualizar una orden con número de guía y cambiar stage
   */
  async updateOrderWithGuia(orderId: string, numeroGuia: string, newStage: string): Promise<boolean> {
    if (!this.isLoggedIn) {
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        return false;
      }
    }

    console.log(`📝 Actualizando orden ${orderId} con guía ${numeroGuia}...`);

    try {
      // Navegar directamente a la orden
      const orderUrl = `https://bigin.zoho.com/bigin/org857936781/Home#/deals/${orderId}`;
      await this.page!.goto(orderUrl, { waitUntil: 'networkidle' });
      await this.page!.waitForTimeout(3000);

      // TODO: Llenar campo de guía
      const guiaInput = await this.page!.$(BiginSelectors.orderDetail.guiaInput);
      if (guiaInput) {
        await guiaInput.fill(numeroGuia);
      }

      // TODO: Llenar transportadora
      const transportadoraInput = await this.page!.$(BiginSelectors.orderDetail.transportadoraInput);
      if (transportadoraInput) {
        await transportadoraInput.fill('Coordinadora');
      }

      // TODO: Cambiar stage
      // Esto requiere interactuar con el dropdown de stage

      // Guardar cambios
      const saveBtn = await this.page!.$(BiginSelectors.orderDetail.saveButton);
      if (saveBtn) {
        await saveBtn.click();
        await this.page!.waitForTimeout(2000);
      }

      console.log(`✅ Orden ${orderId} actualizada`);
      return true;

    } catch (error) {
      console.error('❌ Error actualizando orden:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      this.isLoggedIn = false;
      console.log('🔒 Browser de Bigin cerrado');
    }
  }
}
