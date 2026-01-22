import 'dotenv/config';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Login + Captura de screenshots en una sola sesión
 */
async function loginAndCapture() {
  console.log('🚀 Login y captura de Coordinadora...\n');

  const screenshotsDir = path.join(process.cwd(), 'storage/artifacts');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  try {
    // 1. LOGIN
    console.log('🔐 1. Haciendo login...');
    await page.goto('https://ff.coordinadora.com/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Llenar credenciales
    await page.fill('input[name="usuario"]', process.env.COORDINADORA_USER || '');
    await page.waitForTimeout(500);
    await page.fill('input[name="clave"]', process.env.COORDINADORA_PASSWORD || '');
    await page.waitForTimeout(500);

    // Click en Ingresar
    await page.click('button:has-text("Ingresar")');
    await page.waitForTimeout(5000);

    // Verificar login
    const currentUrl = page.url();
    console.log(`   URL después de login: ${currentUrl}`);

    if (currentUrl.includes('panel') || !currentUrl.includes('ff.coordinadora.com/')) {
      console.log('   ✅ Login exitoso!\n');
    } else {
      // Tomar screenshot para debug
      await page.screenshot({ path: path.join(screenshotsDir, '00-post-login.png') });
      console.log('   ⚠️ Verificar screenshot 00-post-login.png\n');
    }

    // 2. IR A LISTA DE PEDIDOS
    console.log('📋 2. Navegando a lista de pedidos...');
    await page.goto('https://ff.coordinadora.com/panel/pedidos', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(screenshotsDir, '01-lista-pedidos.png'), fullPage: true });
    console.log('   ✅ Screenshot: 01-lista-pedidos.png');

    // Intentar obtener el último número de pedido
    const pageContent = await page.content();
    console.log(`   📄 Contenido de la página (primeros 500 chars):`);
    console.log(`   ${pageContent.substring(0, 500).replace(/\n/g, ' ').substring(0, 200)}...\n`);

    // 3. IR AL FORMULARIO DE AGREGAR PEDIDO
    console.log('📝 3. Navegando al formulario de agregar pedido...');
    await page.goto('https://ff.coordinadora.com/panel/agregar_pedidos/coordinadora', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(screenshotsDir, '02-formulario-pedido.png'), fullPage: true });
    console.log('   ✅ Screenshot: 02-formulario-pedido.png');

    // 4. ANALIZAR CAMPOS DEL FORMULARIO
    console.log('\n🔍 4. Analizando campos del formulario...');

    const inputs = await page.$$('input, select, textarea');
    console.log(`   Encontrados ${inputs.length} campos\n`);

    console.log('   ╔════════════════════════════════════════════════════════════╗');
    console.log('   ║              CAMPOS DEL FORMULARIO                         ║');
    console.log('   ╚════════════════════════════════════════════════════════════╝\n');

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const tagName = await input.evaluate(el => el.tagName.toLowerCase());
      const name = await input.getAttribute('name');
      const id = await input.getAttribute('id');
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');

      // Buscar label
      let labelText = '';
      try {
        labelText = await input.evaluate(el => {
          // Buscar label por for
          if (el.id) {
            const label = document.querySelector(`label[for="${el.id}"]`);
            if (label) return label.textContent || '';
          }
          // Buscar label padre
          const parent = el.closest('label');
          if (parent) return parent.textContent || '';
          // Buscar texto anterior
          const prev = el.previousElementSibling;
          if (prev && prev.tagName === 'LABEL') return prev.textContent || '';
          // Buscar en contenedor padre
          const container = el.closest('div');
          if (container) {
            const label = container.querySelector('label');
            if (label) return label.textContent || '';
          }
          return '';
        });
      } catch (e) {}

      console.log(`   [${(i + 1).toString().padStart(2, '0')}] <${tagName}>`);
      if (labelText.trim()) console.log(`        Label: "${labelText.trim().substring(0, 50)}"`);
      if (name) console.log(`        name="${name}"`);
      if (id) console.log(`        id="${id}"`);
      if (type) console.log(`        type="${type}"`);
      if (placeholder) console.log(`        placeholder="${placeholder}"`);
      console.log('');
    }

    // Buscar botones
    console.log('   ╔════════════════════════════════════════════════════════════╗');
    console.log('   ║                    BOTONES                                 ║');
    console.log('   ╚════════════════════════════════════════════════════════════╝\n');

    const buttons = await page.$$('button, input[type="submit"]');
    for (const btn of buttons) {
      const text = await btn.textContent();
      const type = await btn.getAttribute('type');
      const id = await btn.getAttribute('id');
      if (text?.trim()) {
        console.log(`   BUTTON: "${text.trim()}" (type=${type}, id=${id})`);
      }
    }

    // Buscar radio buttons específicamente
    console.log('\n   ╔════════════════════════════════════════════════════════════╗');
    console.log('   ║                 RADIO BUTTONS                              ║');
    console.log('   ╚════════════════════════════════════════════════════════════╝\n');

    const radios = await page.$$('input[type="radio"]');
    for (const radio of radios) {
      const name = await radio.getAttribute('name');
      const value = await radio.getAttribute('value');
      const id = await radio.getAttribute('id');
      console.log(`   RADIO: name="${name}" value="${value}" id="${id}"`);
    }

    // Buscar selects/dropdowns
    console.log('\n   ╔════════════════════════════════════════════════════════════╗');
    console.log('   ║                  DROPDOWNS                                 ║');
    console.log('   ╚════════════════════════════════════════════════════════════╝\n');

    const selects = await page.$$('select');
    for (const select of selects) {
      const name = await select.getAttribute('name');
      const id = await select.getAttribute('id');
      const options = await select.$$('option');
      console.log(`   SELECT: name="${name}" id="${id}" (${options.length} opciones)`);
    }

    console.log('\n✅ Screenshots guardados en:', screenshotsDir);
    console.log('\n📸 Revisa los screenshots para ver los campos visualmente.');

  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: path.join(screenshotsDir, 'error.png') });
  } finally {
    await browser.close();
  }
}

loginAndCapture();
