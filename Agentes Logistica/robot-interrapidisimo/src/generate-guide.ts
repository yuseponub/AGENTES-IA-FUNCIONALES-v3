import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

// Tamaño 4x6 pulgadas en puntos (72 puntos = 1 pulgada)
const PAGE_WIDTH = 4 * 72;  // 288 puntos
const PAGE_HEIGHT = 6 * 72; // 432 puntos

interface GuideData {
  numero: number;
  ciudad: string;
  nombre: string;
  apellido: string;
  direccion: string;
  barrio: string;
  telefono: string;
  valorCobrar: number;
  pagoAnticipado?: boolean;
}

const ASSETS_PATH = path.join(__dirname, '..', 'assets');

export function generateGuide(data: GuideData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [PAGE_WIDTH, PAGE_HEIGHT],
      margins: { top: 10, bottom: 10, left: 10, right: 10 }
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const contentWidth = PAGE_WIDTH - 20;

    // Logo SOMNIO (centrado y más grande)
    const logoPath = path.join(ASSETS_PATH, 'logo-somnio.png');
    if (fs.existsSync(logoPath)) {
      const logoWidth = 180;
      const logoX = (PAGE_WIDTH - logoWidth) / 2;
      doc.image(logoPath, logoX, 8, { width: logoWidth });
    }

    // Línea separadora
    doc.moveTo(10, 55).lineTo(PAGE_WIDTH - 10, 55).stroke();

    // ENVIO PRIORIDAD #
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text(`ENVIO PRIORIDAD ${data.numero} –`, 10, 63, {
      width: contentWidth,
      align: 'left'
    });

    // Línea separadora
    doc.moveTo(10, 83).lineTo(PAGE_WIDTH - 10, 83).stroke();

    // ENVIAR A:
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('ENVIAR A:', 10, 93);

    // Nombre completo
    doc.font('Helvetica');
    const nombreCompleto = `${data.nombre.toUpperCase()} ${data.apellido.toUpperCase()}`;
    doc.text(nombreCompleto, 70, 93, { width: contentWidth - 60 });

    // Dirección
    doc.text(`${data.direccion} Barrio ${data.barrio}`, 10, 113, {
      width: contentWidth,
      lineGap: 2
    });

    // Ciudad
    doc.text(data.ciudad.toUpperCase(), 10, 133);

    // Teléfono
    doc.text(data.telefono, 10, 150);

    // Línea separadora
    doc.moveTo(10, 170).lineTo(PAGE_WIDTH - 10, 170).stroke();

    // VALOR A COBRAR
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('VALOR A COBRAR:', 10, 180);

    // Valor grande
    doc.fontSize(24).font('Helvetica-Bold');
    const valorMostrar = data.pagoAnticipado ? '$0' : `$${data.valorCobrar.toLocaleString('es-CO')}`;
    doc.text(valorMostrar, 10, 205, {
      width: contentWidth,
      align: 'center'
    });

    // Si es pago anticipado, mostrar texto
    if (data.pagoAnticipado) {
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('PAGO ANTICIPADO', 10, 235, {
        width: contentWidth,
        align: 'center'
      });
    }

    // Línea separadora
    doc.moveTo(10, 255).lineTo(PAGE_WIDTH - 10, 255).stroke();

    // Código de barras
    const barcodePath = path.join(ASSETS_PATH, 'barcode.png');
    if (fs.existsSync(barcodePath)) {
      doc.image(barcodePath, 30, 265, { width: contentWidth - 40, align: 'center' });
    }

    // Número debajo del código de barras
    doc.fontSize(10).font('Helvetica');
    doc.text('4512345678906', 10, 345, {
      width: contentWidth,
      align: 'center'
    });

    doc.end();
  });
}

export async function generateMultipleGuides(guides: GuideData[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [PAGE_WIDTH, PAGE_HEIGHT],
      margins: { top: 10, bottom: 10, left: 10, right: 10 }
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const contentWidth = PAGE_WIDTH - 20;

    guides.forEach((data, index) => {
      if (index > 0) {
        doc.addPage();
      }

      // Logo SOMNIO (centrado y más grande)
      const logoPath = path.join(ASSETS_PATH, 'logo-somnio.png');
      if (fs.existsSync(logoPath)) {
        const logoWidth = 180;
        const logoX = (PAGE_WIDTH - logoWidth) / 2;
        doc.image(logoPath, logoX, 8, { width: logoWidth });
      }

      // Línea separadora
      doc.moveTo(10, 55).lineTo(PAGE_WIDTH - 10, 55).stroke();

      // ENVIO PRIORIDAD #
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text(`ENVIO PRIORIDAD ${data.numero} –`, 10, 63, {
        width: contentWidth,
        align: 'left'
      });

      // Línea separadora
      doc.moveTo(10, 83).lineTo(PAGE_WIDTH - 10, 83).stroke();

      // ENVIAR A:
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('ENVIAR A:', 10, 93);

      // Nombre completo
      doc.font('Helvetica');
      const nombreCompleto = `${data.nombre.toUpperCase()} ${data.apellido.toUpperCase()}`;
      doc.text(nombreCompleto, 70, 93, { width: contentWidth - 60 });

      // Dirección
      doc.text(`${data.direccion} Barrio ${data.barrio}`, 10, 113, {
        width: contentWidth,
        lineGap: 2
      });

      // Ciudad
      doc.text(data.ciudad.toUpperCase(), 10, 133);

      // Teléfono
      doc.text(data.telefono, 10, 150);

      // Línea separadora
      doc.moveTo(10, 170).lineTo(PAGE_WIDTH - 10, 170).stroke();

      // VALOR A COBRAR
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('VALOR A COBRAR:', 10, 180);

      // Valor grande
      doc.fontSize(24).font('Helvetica-Bold');
      const valorMostrar = data.pagoAnticipado ? '$0' : `$${data.valorCobrar.toLocaleString('es-CO')}`;
      doc.text(valorMostrar, 10, 205, {
        width: contentWidth,
        align: 'center'
      });

      // Si es pago anticipado, mostrar texto
      if (data.pagoAnticipado) {
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('PAGO ANTICIPADO', 10, 235, {
          width: contentWidth,
          align: 'center'
        });
      }

      // Línea separadora
      doc.moveTo(10, 255).lineTo(PAGE_WIDTH - 10, 255).stroke();

      // Código de barras
      const barcodePath = path.join(ASSETS_PATH, 'barcode.png');
      if (fs.existsSync(barcodePath)) {
        doc.image(barcodePath, 30, 260, { width: contentWidth - 40 });
      }

      // Número debajo del código de barras
      doc.fontSize(10).font('Helvetica');
      doc.text('4512345678906', 10, 340, {
        width: contentWidth,
        align: 'center'
      });
    });

    doc.end();
  });
}
