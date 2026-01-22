import 'dotenv/config';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Script para capturar screenshots del portal de Coordinadora
 * y extraer información de los campos del formulario
 */
async function captureScreenshots() {
  console.log('📸 Capturando screenshots de Coordinadora...\n');

  const cookiesPath = path.join(process.cwd(), 'storage/sessions/coordinadora-cookies.json');
  const screenshotsDir = path.join(process.cwd(), 'storage/artifacts');

  // Crear directorio si no existe
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  // Cargar cookies
  if (fs.existsSync(cookiesPath)) {
    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
    await context.addCookies(cookies);
    console.log('🍪 Cookies cargadas\n');
  }

  const page = await context.newPage();

  try {
    // 1. Screenshot de la lista de pedidos
    console.log('📋 1. Navegando a lista de pedidos...');
    await page.goto('https://ff.coordinadora.com/panel/pedidos', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(screenshotsDir, '01-lista-pedidos.png'), fullPage: true });
    console.log('   ✅ Screenshot: 01-lista-pedidos.png');

    // Intentar obtener el último número de pedido
    const tableRows = await page.$$('table tbody tr');
    if (tableRows.length > 0) {
      const firstRow = tableRows[0];
      const cells = await firstRow.$$('td');
      if (cells.length > 0) {
        const firstCellText = await cells[0].textContent();
        console.log(`   📍 Último pedido encontrado: ${firstCellText?.trim()}`);
      }
    }

    // 2. Screenshot del formulario de agregar pedido
    console.log('\n📝 2. Navegando al formulario de agregar pedido...');
    await page.goto('https://ff.coordinadora.com/panel/agregar_pedidos/coordinadora', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(screenshotsDir, '02-formulario-pedido.png'), fullPage: true });
    console.log('   ✅ Screenshot: 02-formulario-pedido.png');

    // 3. Extraer información de los campos del formulario
    console.log('\n🔍 3. Analizando campos del formulario...');

    // Buscar todos los inputs
    const inputs = await page.$$('input, select, textarea');
    console.log(`   Encontrados ${inputs.length} campos\n`);

    console.log('   === CAMPOS DEL FORMULARIO ===\n');

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const tagName = await input.evaluate(el => el.tagName.toLowerCase());
      const name = await input.getAttribute('name');
      const id = await input.getAttribute('id');
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      const className = await input.getAttribute('class');

      // Obtener el label asociado si existe
      let labelText = '';
      try {
        if (id) {
          const label = await page.$(`label[for="${id}"]`);
          if (label) {
            labelText = await label.textContent() || '';
          }
        }
        // Buscar label padre o anterior
        if (!labelText) {
          const parentLabel = await input.evaluate(el => {
            const label = el.closest('label') || el.parentElement?.querySelector('label') || el.parentElement?.previousElementSibling;
            return label?.textContent || '';
          });
          labelText = parentLabel;
        }
      } catch (e) {}

      if (name || id || placeholder) {
        console.log(`   [${i + 1}] ${tagName.toUpperCase()}`);
        if (labelText) console.log(`       Label: "${labelText.trim()}"`);
        if (name) console.log(`       name="${name}"`);
        if (id) console.log(`       id="${id}"`);
        if (type) console.log(`       type="${type}"`);
        if (placeholder) console.log(`       placeholder="${placeholder}"`);
        console.log('');
      }
    }

    // Buscar botones
    console.log('   === BOTONES ===\n');
    const buttons = await page.$$('button, input[type="submit"]');
    for (const btn of buttons) {
      const text = await btn.textContent();
      const type = await btn.getAttribute('type');
      const className = await btn.getAttribute('class');
      if (text?.trim()) {
        console.log(`   BUTTON: "${text.trim()}" (type=${type}, class=${className})`);
      }
    }

    console.log('\n✅ Screenshots guardados en:', screenshotsDir);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

captureScreenshots();
