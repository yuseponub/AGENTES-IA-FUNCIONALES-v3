import * as fs from 'fs';
import * as path from 'path';
import { generateGuide, generateMultipleGuides } from './generate-guide';

async function test() {
  console.log('🚀 Generando guía de prueba...\n');

  // Datos de prueba
  const guiaPrueba = {
    numero: 1,
    ciudad: 'BOGOTA',
    nombre: 'BERNARDA',
    apellido: 'GOMEZ ARIAS',
    direccion: 'Calle 120 19a 56',
    barrio: 'Santa Barbara USAQUEN',
    telefono: '3152961225',
    valorCobrar: 77900
  };

  try {
    // Generar una guía
    const pdfBuffer = await generateGuide(guiaPrueba);
    const outputPath = path.join(__dirname, '..', 'output', 'guia-test.pdf');

    // Crear directorio output si no existe
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, pdfBuffer);
    console.log(`✅ Guía generada: ${outputPath}`);
    console.log(`   Tamaño: ${(pdfBuffer.length / 1024).toFixed(2)} KB\n`);

    // Generar múltiples guías
    const multipleGuias = [
      { ...guiaPrueba, numero: 1 },
      { ...guiaPrueba, numero: 2, nombre: 'JOSE', apellido: 'ROMERO', ciudad: 'MEDELLIN', valorCobrar: 109900 },
      { ...guiaPrueba, numero: 3, nombre: 'MARIA', apellido: 'LOPEZ', ciudad: 'CALI', valorCobrar: 139900 },
    ];

    const multiPdfBuffer = await generateMultipleGuides(multipleGuias);
    const multiOutputPath = path.join(__dirname, '..', 'output', 'guias-multiple.pdf');
    fs.writeFileSync(multiOutputPath, multiPdfBuffer);
    console.log(`✅ PDF con ${multipleGuias.length} guías: ${multiOutputPath}`);
    console.log(`   Tamaño: ${(multiPdfBuffer.length / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

test();
