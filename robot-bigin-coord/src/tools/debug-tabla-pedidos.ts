import 'dotenv/config';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Debug: Analizar estructura de la tabla de pedidos
 */
async function debugTablaPedidos() {
  console.log('🔍 Debug: Analizando tabla de pedidos...\n');

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

    // Analizar la tabla
    console.log('=== ESTRUCTURA DE LA TABLA ===\n');

    // Buscar todas las tablas
    const tables = await page.$$('table');
    console.log(`Tablas encontradas: ${tables.length}\n`);

    if (tables.length > 0) {
      const table = tables[0];

      // Headers
      const headers = await table.$$('thead th, th');
      console.log('Headers:');
      for (const h of headers) {
        const text = await h.textContent();
        console.log(`  - ${text?.trim()}`);
      }

      // Primera fila del body
      console.log('\nPrimera fila (tbody tr:first-child):');
      const firstRow = await table.$('tbody tr:first-child');
      if (firstRow) {
        const cells = await firstRow.$$('td');
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          const text = await cell.textContent();
          const innerHTML = await cell.innerHTML();
          console.log(`  [${i}] Text: "${text?.trim().substring(0, 50)}"`);
          if (innerHTML.includes('<a')) {
            const link = await cell.$('a');
            if (link) {
              const href = await link.getAttribute('href');
              const linkText = await link.textContent();
              console.log(`      Link: "${linkText}" -> ${href}`);
            }
          }
        }
      }

      // Intentar diferentes selectores para el número de pedido
      console.log('\n=== PROBANDO SELECTORES ===\n');

      const selectors = [
        'table tbody tr:first-child td:first-child',
        'table tbody tr:first-child td:first-child a',
        'table tbody tr:nth-child(1) td:nth-child(1)',
        'table tbody tr:nth-child(1) td:nth-child(1) a',
        'tbody tr td:first-child a',
        'td a[href*="pedidos"]',
      ];

      for (const sel of selectors) {
        const el = await page.$(sel);
        if (el) {
          const text = await el.textContent();
          console.log(`✓ "${sel}"`);
          console.log(`  -> "${text?.trim()}"`);
        } else {
          console.log(`✗ "${sel}" - no encontrado`);
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugTablaPedidos();
