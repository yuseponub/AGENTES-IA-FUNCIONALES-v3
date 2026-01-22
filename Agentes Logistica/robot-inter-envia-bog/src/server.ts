import express from 'express';
import cors from 'cors';
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { generateGuide, generateMultipleGuides } from './generate-guide';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3002;
// Guardar en carpeta de n8n para servir via Caddy
const OUTPUT_DIR = '/opt/n8n/local-files';
const PUBLIC_URL = 'https://n8n.automatizacionesmorf.com/download';

// Crear directorio output si no existe
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'interrapidisimo-bot' });
});

// Generar una sola guía
app.post('/api/generar-guia', async (req, res) => {
  try {
    const { numero, ciudad, nombre, apellido, direccion, barrio, telefono, valorCobrar } = req.body;

    if (!ciudad || !nombre || !direccion || !telefono) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos: ciudad, nombre, direccion, telefono'
      });
    }

    const guiaData = {
      numero: numero || 1,
      ciudad: ciudad.toUpperCase(),
      nombre: nombre.toUpperCase(),
      apellido: (apellido || '').toUpperCase(),
      direccion,
      barrio: barrio || '',
      telefono,
      valorCobrar: valorCobrar || 0
    };

    const pdfBuffer = await generateGuide(guiaData);
    const filename = `guia-${ciudad}-${numero || 1}-${Date.now()}.pdf`;
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, pdfBuffer);

    console.log(`✅ Guía generada: ${filename}`);

    res.json({
      success: true,
      filename,
      downloadUrl: `${PUBLIC_URL}/${filename}`,
      size: pdfBuffer.length
    });

  } catch (error: any) {
    console.error('❌ Error generando guía:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generar múltiples guías (un PDF con todas)
app.post('/api/generar-guias', async (req, res) => {
  try {
    const { pedidos } = req.body;

    if (!pedidos || !Array.isArray(pedidos) || pedidos.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de pedidos'
      });
    }

    // Asignar números secuenciales y detectar pago anticipado
    const guias = pedidos.map((p: any, index: number) => {
      const nombreCompleto = `${p.nombres || p.nombre || ''} ${p.apellidos || p.apellido || ''}`;
      const tienePagoAnticipado = p.pagoAnticipado ||
        nombreCompleto.includes('&') ||
        (p.tags && p.tags.includes('PAGO ANTICIPADO'));

      return {
        numero: index + 1,
        ciudad: (p.ciudad || 'BOGOTA').toUpperCase(),
        nombre: (p.nombres || p.nombre || '').toUpperCase(),
        apellido: (p.apellidos || p.apellido || '').toUpperCase(),
        direccion: p.direccion || '',
        barrio: p.barrio || '',
        telefono: p.celular || p.telefono || '',
        valorCobrar: p.totalConIva || p.valorCobrar || p.valor || 0,
        pagoAnticipado: tienePagoAnticipado
      };
    });

    const pdfBuffer = await generateMultipleGuides(guias);
    const filename = `guias-inter-${Date.now()}.pdf`;
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, pdfBuffer);

    console.log(`✅ ${guias.length} guías generadas: ${filename}`);

    res.json({
      success: true,
      total: guias.length,
      filename,
      downloadUrl: `${PUBLIC_URL}/${filename}`,
      size: pdfBuffer.length,
      guias: guias.map((g, i) => ({
        numero: g.numero,
        nombre: `${g.nombre} ${g.apellido}`,
        ciudad: g.ciudad
      }))
    });

  } catch (error: any) {
    console.error('❌ Error generando guías:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Descargar PDF generado
app.get('/api/download/:filename', (req, res) => {
  const { filename } = req.params;
  const filepath = path.join(OUTPUT_DIR, filename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({
      success: false,
      error: 'Archivo no encontrado'
    });
  }

  res.download(filepath, filename);
});

// Listar PDFs generados
app.get('/api/guias', (req, res) => {
  const files = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('.pdf'))
    .map(f => ({
      filename: f,
      downloadUrl: `${PUBLIC_URL}/${f}`,
      size: fs.statSync(path.join(OUTPUT_DIR, f)).size,
      created: fs.statSync(path.join(OUTPUT_DIR, f)).mtime
    }))
    .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

  res.json({ success: true, total: files.length, files });
});

// Generar Excel para Envía
app.post('/api/generar-excel-envia', async (req, res) => {
  try {
    const { ordenes, biginIds } = req.body;

    if (!ordenes || !Array.isArray(ordenes) || ordenes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de ordenes'
      });
    }

    // Crear workbook y worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ordenes Envía');

    // Definir columnas
    worksheet.columns = [
      { header: 'Valor', key: 'valor', width: 15 },
      { header: 'Nombre completo', key: 'nombreCompleto', width: 30 },
      { header: 'Telefono', key: 'telefono', width: 15 },
      { header: 'Direccion completa', key: 'direccion', width: 40 },
      { header: 'Municipio', key: 'municipio', width: 20 },
      { header: 'Departamento', key: 'departamento', width: 20 }
    ];

    // Estilo para encabezados
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Agregar filas
    ordenes.forEach((orden: any) => {
      worksheet.addRow({
        valor: orden.Valor || orden.valor || 0,
        nombreCompleto: orden['Nombre completo'] || orden.nombreCompleto || '',
        telefono: orden.Telefono || orden.telefono || '',
        direccion: orden['Direccion completa'] || orden.direccion || '',
        municipio: orden.Municipio || orden.municipio || '',
        departamento: orden.Departamento || orden.departamento || ''
      });
    });

    // Generar archivo
    const filename = `envia-${Date.now()}.xlsx`;
    const filepath = path.join(OUTPUT_DIR, filename);
    await workbook.xlsx.writeFile(filepath);

    console.log(`✅ Excel Envía generado: ${filename} (${ordenes.length} órdenes)`);

    res.json({
      success: true,
      total: ordenes.length,
      filename,
      downloadUrl: `${PUBLIC_URL}/${filename}`,
      ordenes: ordenes,
      biginIds: biginIds || []
    });

  } catch (error: any) {
    console.error('❌ Error generando Excel Envía:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`
════════════════════════════════════════════════════════════
🚀 INTERRAPIDÍSIMO BOT API
════════════════════════════════════════════════════════════
📍 URL: http://localhost:${PORT}

📋 Endpoints disponibles:
   GET  /api/health              - Estado del servicio
   POST /api/generar-guia        - Generar una guía
   POST /api/generar-guias       - Generar múltiples guías
   POST /api/generar-excel-envia - Generar Excel para Envía
   GET  /api/download/:file      - Descargar PDF/Excel
   GET  /api/guias               - Listar archivos generados

⏳ Esperando requests de n8n...
════════════════════════════════════════════════════════════
  `);
});
