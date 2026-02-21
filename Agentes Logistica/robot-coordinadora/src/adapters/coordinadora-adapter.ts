import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { CoordinadoraConfig, CreateGuiaInput, GuiaResult } from '../types/index.js';

// URLs del portal de Coordinadora
const URLS = {
  login: 'https://ff.coordinadora.com/',
  pedidos: 'https://ff.coordinadora.com/panel/pedidos',
  agregarPedido: 'https://ff.coordinadora.com/panel/agregar_pedidos/coordinadora',
};

// Selectores EXACTOS del portal de Coordinadora (verificados con screenshots)
const CoordinadoraSelectors = {
  login: {
    userInput: 'input[name="usuario"]',
    passwordInput: 'input[name="clave"]',
    loginButton: 'button:has-text("Ingresar")',
  },
  pedidosList: {
    // MUI DataGrid - los números de pedido están en celdas con links
    dataGrid: '.MuiDataGrid-root',
    // Primera celda de la primera fila (el número de pedido más reciente)
    firstPedidoLink: '.MuiDataGrid-cell a',
    // Alternativa: buscar por role
    cellWithNumber: '[role="cell"] a',
  },
  pedidoForm: {
    // Información destinatario
    identificacionDestinatario: 'input[name="identificacion_destinatario"]',
    nombresDestinatario: 'input[name="nombres_destinatario"]',
    apellidosDestinatario: 'input[name="apellidos_destinatario"]',
    direccionDestinatario: 'input[name="direccion_destinatario"]',
    // Ciudad destinatario es un autocomplete de MUI - buscar por label
    ciudadDestinatario: 'input[id^="mui-"]',
    telefonoCelularDestinatario: 'input[name="telefono_celular_destinatario"]',
    emailDestinatario: 'input[name="email_destinatario"]',

    // Información pedido
    numeroPedido: 'input[name="numero_pedido"]',
    referencia: 'input[name="referencia"]',
    unidades: 'input[name="unidades"]',
    totalIva: 'input[name="total_iva"]',
    totalConIva: 'input[name="total_coniva"]',
    valorDeclarado: 'input[name="valor_declarado"]',

    // Radio buttons - Pago contra entrega
    pagoContraEntregaSi: 'input[name="pago_contra_entrega"][value="S"]',
    pagoContraEntregaNo: 'input[name="pago_contra_entrega"][value="N"]',

    // Radio buttons - Flete contra entrega
    fleteContraEntregaSi: 'input[name="flete_contra_entrega"][value="S"]',
    fleteContraEntregaNo: 'input[name="flete_contra_entrega"][value="N"]',

    // Información medidas
    peso: 'input[name="peso"]',
    alto: 'input[name="alto"]',
    largo: 'input[name="largo"]',
    ancho: 'input[name="ancho"]',

    // Botones
    submitButton: 'button[type="submit"]:has-text("Enviar Pedido"), button:has-text("ENVIAR PEDIDO")',
    cancelButton: 'button:has-text("Cancelar"), button:has-text("CANCELAR")',
  },
  result: {
    // SweetAlert2 notifications
    successNotification: '.swal-modal, .swal2-popup, .swal2-success, [class*="swal"]',
    successIcon: '.swal-icon--success, .swal2-success',
    errorNotification: '.swal-icon--error, .swal2-error',
    confirmButton: '.swal-button, .swal2-confirm, button:has-text("OK"), button:has-text("Aceptar")',
  },
};

export class CoordinadoraAdapter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: CoordinadoraConfig;
  private cookiesPath: string;
  private isLoggedIn: boolean = false;

  constructor(config: CoordinadoraConfig) {
    this.config = config;
    this.cookiesPath = path.join(process.cwd(), 'storage/sessions/coordinadora-cookies.json');
  }

  async init(): Promise<void> {
    console.log('🚀 Iniciando browser para Coordinadora...');

    this.browser = await chromium.launch({
      headless: true, // true para servidor, false para debug local
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
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
        console.log('🍪 Cookies cargadas');
      } catch (e) {
        console.log('⚠️ No se pudieron cargar cookies');
      }
    }

    this.page = await this.context.newPage();
    console.log('✅ Browser iniciado');
  }

  async login(): Promise<boolean> {
    if (!this.page) {
      await this.init();
    }

    console.log('🔐 Iniciando login en Coordinadora...');

    try {
      await this.page!.goto(URLS.login, { waitUntil: 'networkidle' });
      await this.page!.waitForTimeout(2000);

      // Verificar si ya estamos logueados (redirigidos a /panel)
      if (this.page!.url().includes('/panel')) {
        console.log('✅ Sesión ya activa');
        this.isLoggedIn = true;
        return true;
      }

      // Llenar usuario
      console.log('📝 Llenando usuario...');
      await this.page!.fill(CoordinadoraSelectors.login.userInput, this.config.user);
      await this.page!.waitForTimeout(500);

      // Llenar contraseña
      console.log('📝 Llenando contraseña...');
      await this.page!.fill(CoordinadoraSelectors.login.passwordInput, this.config.password);
      await this.page!.waitForTimeout(500);

      // Click en Ingresar
      console.log('🖱️ Haciendo click en login...');
      await this.page!.click(CoordinadoraSelectors.login.loginButton);
      await this.page!.waitForTimeout(5000);

      // Verificar login exitoso
      if (this.page!.url().includes('/panel')) {
        console.log('✅ Login exitoso');
        await this.saveCookies();
        this.isLoggedIn = true;
        return true;
      }

      console.log('❌ Login falló - verificar credenciales');
      return false;

    } catch (error) {
      console.error('❌ Error en login:', error);
      return false;
    }
  }

  private async saveCookies(): Promise<void> {
    if (!this.context) return;

    try {
      const cookies = await this.context.cookies();
      const dir = path.dirname(this.cookiesPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.cookiesPath, JSON.stringify(cookies, null, 2));
      console.log('🍪 Cookies guardadas');
    } catch (e) {
      console.log('⚠️ No se pudieron guardar cookies');
    }
  }

  /**
   * Obtener el último número de pedido para calcular el siguiente
   * Con reintentos si falla
   */
  async getLastPedidoNumber(): Promise<number> {
    if (!this.isLoggedIn) {
      await this.login();
    }

    console.log('📋 Obteniendo último número de pedido...');

    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`   Intento ${attempt}/${maxRetries}...`);

        // Navegar a la página de pedidos
        await this.page!.goto(URLS.pedidos, { waitUntil: 'networkidle', timeout: 30000 });

        // Esperar que el DataGrid aparezca
        await this.page!.waitForSelector('.MuiDataGrid-root', { timeout: 10000 }).catch(() => {
          console.log('   ⚠️ DataGrid no encontrado, esperando más...');
        });

        // Esperar un poco más para que carguen los datos
        await this.page!.waitForTimeout(2000);

        // Esperar que haya al menos un link en las celdas
        await this.page!.waitForSelector('.MuiDataGrid-cell a', { timeout: 10000 }).catch(() => {
          console.log('   ⚠️ Links no encontrados aún...');
        });

        // Buscar todos los links con números de pedido
        const allLinks = await this.page!.$$('.MuiDataGrid-cell a');
        console.log(`   Encontrados ${allLinks.length} links`);

        let maxNumber = 0;

        for (const link of allLinks.slice(0, 20)) {
          const text = await link.textContent();
          const num = parseInt(text?.trim() || '', 10);
          if (!isNaN(num) && num > maxNumber && num > 1000) {
            maxNumber = num;
          }
        }

        if (maxNumber > 0) {
          console.log(`📍 Último pedido: ${maxNumber}`);
          return maxNumber;
        }

        // Si no encontró, intentar con selector alternativo
        const altLinks = await this.page!.$$('[role="cell"] a');
        console.log(`   Buscando con selector alternativo: ${altLinks.length} links`);

        for (const link of altLinks.slice(0, 20)) {
          const text = await link.textContent();
          const num = parseInt(text?.trim() || '', 10);
          if (!isNaN(num) && num > maxNumber && num > 1000) {
            maxNumber = num;
          }
        }

        if (maxNumber > 0) {
          console.log(`📍 Último pedido (alt): ${maxNumber}`);
          return maxNumber;
        }

        console.log(`   ⚠️ Intento ${attempt} falló, no se encontraron números`);

        if (attempt < maxRetries) {
          console.log('   Reintentando en 3 segundos...');
          await this.page!.waitForTimeout(3000);
        }

      } catch (error) {
        console.error(`   ❌ Error en intento ${attempt}:`, error);
        if (attempt < maxRetries) {
          await this.page!.waitForTimeout(2000);
        }
      }
    }

    console.log('⚠️ No se pudo obtener número de pedido después de reintentos, usando fallback');
    return this.getLastKnownPedido();
  }

  // Leer último pedido conocido de archivo (fallback)
  private getLastKnownPedido(): number {
    try {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(process.cwd(), '.ultimo-pedido.txt');
      if (fs.existsSync(filePath)) {
        const num = parseInt(fs.readFileSync(filePath, 'utf-8').trim(), 10);
        if (!isNaN(num) && num > 9000) {
          console.log(`📍 Usando último pedido guardado: ${num}`);
          return num;
        }
      }
    } catch (e) {}
    return 9640; // Fallback inicial alto
  }

  // Guardar último pedido creado
  private saveLastPedido(numero: number): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(process.cwd(), '.ultimo-pedido.txt');
      fs.writeFileSync(filePath, numero.toString());
    } catch (e) {}
  }

  /**
   * Crear pedido en Coordinadora
   */
  async createGuia(input: CreateGuiaInput): Promise<GuiaResult> {
    if (!this.isLoggedIn) {
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        return { success: false, error: 'No se pudo iniciar sesión en Coordinadora' };
      }
    }

    console.log('📦 Creando pedido en Coordinadora...');
    console.log('   Destinatario:', input.nombreDestinatario);
    console.log('   Ciudad:', input.ciudadDestino);

    try {
      // 1. Obtener último número de pedido
      const lastNumber = await this.getLastPedidoNumber();
      const newNumber = lastNumber + 1;
      console.log(`📍 Nuevo número de pedido: ${newNumber}`);

      // 2. Navegar al formulario
      await this.page!.goto(URLS.agregarPedido, { waitUntil: 'networkidle' });
      await this.page!.waitForTimeout(3000);

      // 3. Llenar formulario
      console.log('📝 Llenando formulario...');

      // Información destinatario
      await this.fillInput('identificacionDestinatario', '123456789'); // Placeholder - ajustar según datos reales
      await this.fillInput('nombresDestinatario', input.nombreDestinatario.split(' ')[0] || input.nombreDestinatario);
      await this.fillInput('apellidosDestinatario', input.nombreDestinatario.split(' ').slice(1).join(' ') || 'Cliente');
      await this.fillInput('direccionDestinatario', input.direccionDestinatario);

      // Ciudad destinatario (autocomplete)
      await this.fillCiudadAutocomplete(input.ciudadDestino);

      await this.fillInput('telefonoCelularDestinatario', input.telefonoDestinatario.replace(/\D/g, ''));
      if (input.nombreDestinatario.includes('@')) {
        await this.fillInput('emailDestinatario', input.nombreDestinatario);
      }

      // Información pedido
      await this.fillInput('numeroPedido', newNumber.toString());
      await this.fillInput('referencia', input.referencia1 || `BIGIN-${newNumber}`);
      await this.fillInput('unidades', '1');
      await this.fillInput('totalIva', '0');
      await this.fillInput('totalConIva', (input.valorDeclarado || 77900).toString());
      await this.fillInput('valorDeclarado', (input.valorDeclarado || 77900).toString());

      // Radio buttons - Pago contra entrega SI (esto deshabilita flete automáticamente)
      await this.safeClick(CoordinadoraSelectors.pedidoForm.pagoContraEntregaSi);
      console.log('   ✓ Pago contra entrega: SI');

      // Flete contra entrega - solo intentar si está habilitado
      await this.safeClick(CoordinadoraSelectors.pedidoForm.fleteContraEntregaNo);

      // Información medidas - usar fill directo ya que fillInput puede fallar
      await this.page!.fill(CoordinadoraSelectors.pedidoForm.peso, (input.peso || 1).toString());
      console.log(`   ✓ peso: ${input.peso || 1}`);
      await this.page!.fill(CoordinadoraSelectors.pedidoForm.alto, (input.alto || 10).toString());
      console.log(`   ✓ alto: ${input.alto || 10}`);
      await this.page!.fill(CoordinadoraSelectors.pedidoForm.largo, (input.largo || 20).toString());
      console.log(`   ✓ largo: ${input.largo || 20}`);
      await this.page!.fill(CoordinadoraSelectors.pedidoForm.ancho, (input.ancho || 15).toString());
      console.log(`   ✓ ancho: ${input.ancho || 15}`);

      await this.page!.waitForTimeout(1000);

      // 4. Enviar pedido
      console.log('📤 Enviando pedido...');
      await this.page!.click(CoordinadoraSelectors.pedidoForm.submitButton);
      await this.page!.waitForTimeout(5000);

      // 5. Verificar resultado
      // Buscar notificación de SweetAlert
      const successIcon = await this.page!.$(CoordinadoraSelectors.result.successIcon);
      const errorIcon = await this.page!.$(CoordinadoraSelectors.result.errorNotification);

      if (successIcon) {
        console.log('✅ Pedido creado exitosamente');

        // Guardar último pedido creado para fallback futuro
        this.saveLastPedido(newNumber);

        // Cerrar el modal si hay botón de confirmar
        const confirmBtn = await this.page!.$(CoordinadoraSelectors.result.confirmButton);
        if (confirmBtn) {
          await confirmBtn.click();
        }

        return {
          success: true,
          numeroGuia: newNumber.toString(),
        };
      }

      if (errorIcon) {
        // Obtener mensaje de error
        const modalText = await this.page!.$eval('.swal-text, .swal2-content', el => el.textContent).catch(() => 'Error desconocido');
        return {
          success: false,
          error: `Error del portal: ${modalText}`,
        };
      }

      // Si no hay notificación, verificar URL o asumir éxito
      console.log('✅ Pedido enviado (verificando...)');
      return {
        success: true,
        numeroGuia: newNumber.toString(),
      };

    } catch (error) {
      console.error('❌ Error creando pedido:', error);

      // Guardar screenshot de error
      const errorPath = path.join(process.cwd(), 'storage/artifacts', `error-${Date.now()}.png`);
      await this.page!.screenshot({ path: errorPath });
      console.log(`   Screenshot de error: ${errorPath}`);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  private async fillInput(fieldKey: keyof typeof CoordinadoraSelectors.pedidoForm, value: string): Promise<void> {
    const selector = CoordinadoraSelectors.pedidoForm[fieldKey];
    if (!selector) return;

    try {
      const field = await this.page!.$(selector);
      if (field) {
        await field.fill(value);
        console.log(`   ✓ ${fieldKey}: ${value.substring(0, 30)}${value.length > 30 ? '...' : ''}`);
      }
    } catch (e) {
      console.log(`   ⚠️ Error en ${fieldKey}`);
    }
  }

  private async safeClick(selector: string): Promise<boolean> {
    try {
      const element = await this.page!.$(selector);
      if (!element) return false;

      // Verificar si está habilitado
      const isDisabled = await element.evaluate(el => (el as any).disabled);
      if (isDisabled) {
        console.log(`   ⏭️ Elemento deshabilitado, saltando: ${selector.substring(0, 50)}`);
        return false;
      }

      await element.click();
      return true;
    } catch (e) {
      console.log(`   ⚠️ Error en click: ${selector.substring(0, 30)}`);
      return false;
    }
  }

  private async fillCiudadAutocomplete(ciudad: string): Promise<void> {
    try {
      // El campo de ciudad es un autocomplete de Material UI
      const ciudadInput = await this.page!.$(CoordinadoraSelectors.pedidoForm.ciudadDestinatario);
      if (ciudadInput) {
        await ciudadInput.click();
        await ciudadInput.fill(ciudad);
        await this.page!.waitForTimeout(1000);

        // Esperar a que aparezcan las opciones y seleccionar la primera
        await this.page!.keyboard.press('ArrowDown');
        await this.page!.waitForTimeout(300);
        await this.page!.keyboard.press('Enter');

        console.log(`   ✓ Ciudad: ${ciudad}`);
      }
    } catch (e) {
      console.log(`   ⚠️ Error en ciudad autocomplete`);
    }
  }

  /**
   * Crear pedido con datos YA LIMPIOS (llamado desde n8n/IA)
   * Este método recibe todos los campos exactos, sin necesidad de procesar
   */
  async createGuiaConDatosCompletos(input: {
    identificacion: string;
    nombres: string;
    apellidos: string;
    direccion: string;
    ciudad: string;
    departamento?: string;
    celular: string;
    email?: string;
    referencia: string;
    unidades: number;
    totalIva: number;
    totalConIva: number;
    valorDeclarado: number;
    esRecaudoContraentrega: boolean;
    peso?: number;
    alto?: number;
    largo?: number;
    ancho?: number;
  }): Promise<GuiaResult> {
    if (!this.isLoggedIn) {
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        return { success: false, error: 'No se pudo iniciar sesión en Coordinadora' };
      }
    }

    console.log('📦 Creando pedido en Coordinadora (datos limpios)...');
    console.log(`   Destinatario: ${input.nombres} ${input.apellidos}`);
    console.log(`   Ciudad: ${input.ciudad}`);
    console.log(`   Recaudo: ${input.esRecaudoContraentrega ? 'SI' : 'NO'}`);

    try {
      // 1. Obtener último número de pedido
      const lastNumber = await this.getLastPedidoNumber();
      const newNumber = lastNumber + 1;
      console.log(`📍 Nuevo número de pedido: ${newNumber}`);

      // 2. Navegar al formulario
      await this.page!.goto(URLS.agregarPedido, { waitUntil: 'networkidle' });
      await this.page!.waitForTimeout(3000);

      // 3. Llenar formulario con datos EXACTOS
      console.log('📝 Llenando formulario...');

      // Información destinatario
      await this.fillInput('identificacionDestinatario', input.identificacion);
      await this.fillInput('nombresDestinatario', input.nombres);
      await this.fillInput('apellidosDestinatario', input.apellidos);
      await this.fillInput('direccionDestinatario', input.direccion);

      // Ciudad (buscar con departamento si está disponible)
      const ciudadBusqueda = input.departamento
        ? `${input.ciudad}` // Solo ciudad, el autocomplete mostrará opciones
        : input.ciudad;
      await this.fillCiudadAutocomplete(ciudadBusqueda);

      await this.fillInput('telefonoCelularDestinatario', input.celular);

      if (input.email) {
        await this.fillInput('emailDestinatario', input.email);
      }

      // Información pedido
      await this.fillInput('numeroPedido', newNumber.toString());
      await this.fillInput('referencia', input.referencia);
      await this.fillInput('unidades', input.unidades.toString());
      await this.fillInput('totalIva', input.totalIva.toString());
      await this.fillInput('totalConIva', input.totalConIva.toString());
      await this.fillInput('valorDeclarado', input.valorDeclarado.toString());

      // Radio buttons - Recaudo contra entrega
      if (input.esRecaudoContraentrega) {
        // Verificar si el recaudo está habilitado para esta ciudad
        const recaudoSiElement = await this.page!.$(CoordinadoraSelectors.pedidoForm.pagoContraEntregaSi);
        if (recaudoSiElement) {
          const isDisabled = await recaudoSiElement.evaluate(el => (el as any).disabled);
          if (isDisabled) {
            console.log('   ❌ Recaudo contraentrega NO disponible para esta ciudad');
            return {
              success: false,
              error: `El municipio ${input.ciudad} NO permite recaudo contraentrega. Debe enviarse como pago anticipado o elegir otra transportadora.`,
              numeroGuia: undefined
            };
          }
        }
        await this.safeClick(CoordinadoraSelectors.pedidoForm.pagoContraEntregaSi);
        console.log('   ✓ Pago contra entrega: SI');
      } else {
        await this.safeClick(CoordinadoraSelectors.pedidoForm.pagoContraEntregaNo);
        console.log('   ✓ Pago contra entrega: NO (pago anticipado)');
      }

      // Flete contra entrega - siempre NO
      await this.safeClick(CoordinadoraSelectors.pedidoForm.fleteContraEntregaNo);

      // Información medidas
      await this.page!.fill(CoordinadoraSelectors.pedidoForm.peso, (input.peso || 0.08).toString());
      console.log(`   ✓ peso: ${input.peso || 0.08}`);
      await this.page!.fill(CoordinadoraSelectors.pedidoForm.alto, (input.alto || 5).toString());
      console.log(`   ✓ alto: ${input.alto || 5}`);
      await this.page!.fill(CoordinadoraSelectors.pedidoForm.largo, (input.largo || 5).toString());
      console.log(`   ✓ largo: ${input.largo || 5}`);
      await this.page!.fill(CoordinadoraSelectors.pedidoForm.ancho, (input.ancho || 10).toString());
      console.log(`   ✓ ancho: ${input.ancho || 10}`);

      await this.page!.waitForTimeout(1000);

      // 4. Enviar pedido
      console.log('📤 Enviando pedido...');
      await this.page!.click(CoordinadoraSelectors.pedidoForm.submitButton);
      await this.page!.waitForTimeout(5000);

      // 5. Verificar resultado
      const successIcon = await this.page!.$(CoordinadoraSelectors.result.successIcon);
      const errorIcon = await this.page!.$(CoordinadoraSelectors.result.errorNotification);

      if (successIcon) {
        console.log('✅ Pedido creado exitosamente');

        // Guardar último pedido creado para fallback futuro
        this.saveLastPedido(newNumber);

        const confirmBtn = await this.page!.$(CoordinadoraSelectors.result.confirmButton);
        if (confirmBtn) {
          await confirmBtn.click();
        }

        return {
          success: true,
          numeroGuia: newNumber.toString(),
        };
      }

      if (errorIcon) {
        const modalText = await this.page!.$eval('.swal-text, .swal2-content', el => el.textContent).catch(() => 'Error desconocido');
        return {
          success: false,
          error: `Error del portal: ${modalText}`,
        };
      }

      console.log('✅ Pedido enviado (verificando...)');
      return {
        success: true,
        numeroGuia: newNumber.toString(),
      };

    } catch (error) {
      console.error('❌ Error creando pedido:', error);

      const errorPath = path.join(process.cwd(), 'storage/artifacts', `error-${Date.now()}.png`);
      await this.page!.screenshot({ path: errorPath });
      console.log(`   Screenshot de error: ${errorPath}`);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Buscar guía por número de pedido
   * Navega a la tabla de pedidos, busca por # de pedido y extrae el # de guía
   */
  async buscarGuiaPorPedido(numeroPedido: string): Promise<{ success: boolean; numeroGuia?: string; estado?: string; error?: string }> {
    if (!this.isLoggedIn) {
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        return { success: false, error: 'No se pudo iniciar sesión en Coordinadora' };
      }
    }

    console.log(`🔍 Buscando guía para pedido #${numeroPedido}...`);

    try {
      // 1. Navegar a la página de pedidos
      await this.page!.goto(URLS.pedidos, { waitUntil: 'networkidle', timeout: 30000 });
      await this.page!.waitForTimeout(2000);

      // 2. Usar el campo de búsqueda
      const searchInput = await this.page!.$('input[placeholder*="buscar"], input[type="search"], input.MuiInputBase-input');
      if (searchInput) {
        // Limpiar y escribir el número de pedido
        await searchInput.click();
        await searchInput.fill('');
        await searchInput.fill(numeroPedido);
        await this.page!.keyboard.press('Enter');
        await this.page!.waitForTimeout(2000);
      }

      // 3. Buscar la fila con el pedido
      // La estructura es: Pedido | Guía | Almacén | Fecha | Nombre | ...
      const rows = await this.page!.$$('table tbody tr, .MuiDataGrid-row, [role="row"]');

      for (const row of rows) {
        const cells = await row.$$('td, [role="cell"], .MuiDataGrid-cell');
        if (cells.length >= 2) {
          const pedidoCell = await cells[0].textContent();
          const pedidoText = pedidoCell?.trim() || '';

          // Verificar si es el pedido que buscamos
          if (pedidoText === numeroPedido || pedidoText.includes(numeroPedido)) {
            // Extraer la guía (segunda columna)
            const guiaCell = await cells[1].textContent();
            const guiaText = guiaCell?.trim() || '';

            // Extraer el estado si está disponible (columna ~7)
            let estadoText = '';
            if (cells.length >= 7) {
              const estadoCell = await cells[6].textContent();
              estadoText = estadoCell?.trim() || '';
            }

            if (guiaText && guiaText.length > 5) {
              console.log(`✅ Guía encontrada: ${guiaText}`);
              return {
                success: true,
                numeroGuia: guiaText,
                estado: estadoText
              };
            } else {
              console.log(`⚠️ Pedido ${numeroPedido} encontrado pero sin guía asignada`);
              return {
                success: false,
                error: 'Pedido encontrado pero sin guía asignada aún'
              };
            }
          }
        }
      }

      // Si no encontró con búsqueda, intentar scroll y búsqueda manual
      console.log('⚠️ Buscando en toda la tabla...');

      // Buscar todos los links de pedidos
      const pedidoLinks = await this.page!.$$('a');
      for (const link of pedidoLinks) {
        const text = await link.textContent();
        if (text?.trim() === numeroPedido) {
          // Encontró el pedido, buscar la guía en la misma fila
          const row = await link.evaluateHandle(el => el.closest('tr') || el.closest('[role="row"]'));
          if (row) {
            const rowElement = row.asElement();
            if (rowElement) {
              const cells = await rowElement.$$('td, [role="cell"]');
              if (cells.length >= 2) {
                const guiaText = await cells[1].textContent();
                if (guiaText && guiaText.trim().length > 5) {
                  console.log(`✅ Guía encontrada (método 2): ${guiaText.trim()}`);
                  return {
                    success: true,
                    numeroGuia: guiaText.trim()
                  };
                }
              }
            }
          }
        }
      }

      console.log(`❌ No se encontró el pedido #${numeroPedido}`);
      return {
        success: false,
        error: `No se encontró el pedido #${numeroPedido}`
      };

    } catch (error) {
      console.error('❌ Error buscando guía:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Buscar múltiples guías por números de pedido
   */
  async buscarGuiasPorPedidos(numerosPedidos: string[]): Promise<Array<{ numeroPedido: string; numeroGuia?: string; estado?: string; success: boolean; error?: string }>> {
    const resultados: Array<{ numeroPedido: string; numeroGuia?: string; estado?: string; success: boolean; error?: string }> = [];

    if (!this.isLoggedIn) {
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        return numerosPedidos.map(num => ({
          numeroPedido: num,
          success: false,
          error: 'No se pudo iniciar sesión en Coordinadora'
        }));
      }
    }

    console.log(`🔍 Buscando guías para ${numerosPedidos.length} pedidos...`);

    try {
      // Navegar a la página de pedidos una sola vez
      await this.page!.goto(URLS.pedidos, { waitUntil: 'networkidle', timeout: 30000 });
      await this.page!.waitForTimeout(3000);

      // Obtener todos los pedidos visibles de la tabla
      const pedidosEnTabla = new Map<string, { guia: string; estado: string }>();

      // Recorrer todas las filas de la tabla
      const rows = await this.page!.$$('table tbody tr');
      for (const row of rows) {
        const cells = await row.$$('td');
        if (cells.length >= 2) {
          const pedidoLink = await cells[0].$('a');
          if (pedidoLink) {
            const pedidoText = await pedidoLink.textContent();
            const guiaText = await cells[1].textContent();
            let estadoText = '';
            if (cells.length >= 7) {
              estadoText = await cells[6].textContent() || '';
            }

            if (pedidoText && guiaText) {
              pedidosEnTabla.set(pedidoText.trim(), {
                guia: guiaText.trim(),
                estado: estadoText.trim()
              });
            }
          }
        }
      }

      console.log(`📋 Encontrados ${pedidosEnTabla.size} pedidos en la tabla`);

      // Buscar cada pedido solicitado
      for (const numeroPedido of numerosPedidos) {
        const info = pedidosEnTabla.get(numeroPedido);
        if (info && info.guia && info.guia.length > 5) {
          resultados.push({
            numeroPedido,
            numeroGuia: info.guia,
            estado: info.estado,
            success: true
          });
          console.log(`  ✅ ${numeroPedido} → ${info.guia}`);
        } else if (info) {
          resultados.push({
            numeroPedido,
            success: false,
            error: 'Pedido encontrado pero sin guía asignada'
          });
          console.log(`  ⚠️ ${numeroPedido} → sin guía`);
        } else {
          // Intentar búsqueda individual
          const result = await this.buscarGuiaPorPedido(numeroPedido);
          resultados.push({
            numeroPedido,
            ...result
          });
        }

        // Pequeña pausa entre búsquedas
        await this.page!.waitForTimeout(500);
      }

      return resultados;

    } catch (error) {
      console.error('❌ Error buscando guías:', error);
      return numerosPedidos.map(num => ({
        numeroPedido: num,
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      }));
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      this.isLoggedIn = false;
      console.log('🔒 Browser cerrado');
    }
  }
}
