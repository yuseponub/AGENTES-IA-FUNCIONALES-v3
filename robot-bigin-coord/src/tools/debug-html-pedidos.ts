import 'dotenv/config';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function debugHtmlPedidos() {
  console.log('🔍 Debug: Analizando HTML de la página de pedidos...\n');

  const cookiesPath = path.join(process.cwd(), 'storage/sessions/coordinadora-cookies.json');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

  if (fs.existsSync(cookiesPath)) {
    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
    await context.addCookies(cookies);
  }

  const page = await context.newPage();

  try {
    // Login
    await page.goto('https://ff.coordinadora.com/', { waitUntil: 'networkidle' });
    if (!page.url().includes('/panel')) {
      await page.fill('input[name="usuario"]', process.env.COORDINADORA_USER || '');
      await page.fill('input[name="clave"]', process.env.COORDINADORA_PASSWORD || '');
      await page.click('button:has-text("Ingresar")');
      await page.waitForTimeout(5000);
    }

    // Ir a pedidos
    await page.goto('https://ff.coordinadora.com/panel/pedidos', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Buscar elementos que contengan números de pedido (9597, 9596, etc.)
    console.log('=== BUSCANDO NÚMEROS DE PEDIDO ===\n');

    // Buscar cualquier elemento que contenga "959"
    const elements = await page.$$('*');
    const foundElements: string[] = [];

    for (const el of elements.slice(0, 500)) { // Limitar para no tardar mucho
      try {
        const text = await el.textContent();
        if (text && /^9\d{3}$/.test(text.trim())) {
          const tagName = await el.evaluate(e => e.tagName);
          const className = await el.getAttribute('class');
          const parentTag = await el.evaluate(e => e.parentElement?.tagName || 'none');
          foundElements.push(`${tagName} (class="${className}", parent=${parentTag}): "${text.trim()}"`);
        }
      } catch (e) {}
    }

    console.log('Elementos con números de 4 dígitos empezando por 9:');
    foundElements.slice(0, 20).forEach(e => console.log(`  ${e}`));

    // Buscar links con números
    console.log('\n=== LINKS CON NÚMEROS ===\n');
    const links = await page.$$('a');
    for (const link of links.slice(0, 50)) {
      const text = await link.textContent();
      if (text && /\d{4}/.test(text)) {
        const href = await link.getAttribute('href');
        console.log(`  "${text.trim()}" -> ${href}`);
      }
    }

    // Buscar el container principal
    console.log('\n=== ESTRUCTURA DEL CONTENEDOR PRINCIPAL ===\n');

    // MUI DataGrid suele usar role="grid" o clases específicas
    const possibleGrids = await page.$$('[role="grid"], .MuiDataGrid-root, [class*="grid"], [class*="table"]');
    console.log(`Posibles grids encontrados: ${possibleGrids.length}`);

    for (const grid of possibleGrids) {
      const className = await grid.getAttribute('class');
      const role = await grid.getAttribute('role');
      console.log(`  class="${className}" role="${role}"`);
    }

    // Guardar el HTML para análisis
    const html = await page.content();
    const htmlPath = path.join(process.cwd(), 'storage/artifacts/pedidos-page.html');
    fs.writeFileSync(htmlPath, html);
    console.log(`\n📄 HTML guardado en: ${htmlPath}`);

    // Extraer parte relevante
    const bodyContent = await page.$eval('body', el => el.innerHTML);
    const relevantPart = bodyContent.substring(0, 5000);
    console.log('\n=== PRIMEROS 2000 CHARS DEL BODY ===\n');
    console.log(relevantPart.substring(0, 2000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugHtmlPedidos();
