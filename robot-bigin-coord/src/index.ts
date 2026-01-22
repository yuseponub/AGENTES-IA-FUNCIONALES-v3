import 'dotenv/config';
import { BiginAdapter } from './adapters/bigin-adapter.js';
import { CoordinadoraAdapter } from './adapters/coordinadora-adapter.js';
import { BiginOrder, CreateGuiaInput, SyncResult } from './types/index.js';

/**
 * Orquestador del flujo Bigin → Coordinadora
 *
 * Flujo:
 * 1. Obtener órdenes de Bigin en stage específico (del pipeline "logistica")
 * 2. Para cada orden, crear guía en Coordinadora
 * 3. Actualizar la orden en Bigin con el número de guía
 * 4. Cambiar el stage de la orden a "COORDINADORA"
 */
export class BiginCoordinadoraSync {
  private bigin: BiginAdapter;
  private coordinadora: CoordinadoraAdapter;
  private sourcePipeline: string;
  private sourceStage: string;
  private targetStage: string;

  constructor() {
    // Configuración de Bigin
    this.bigin = new BiginAdapter({
      url: process.env.BIGIN_URL || 'https://accounts.zoho.com/signin',
      email: process.env.BIGIN_EMAIL || '',
      password: process.env.BIGIN_PASSWORD || '',
      passphrase: process.env.BIGIN_PASSPHRASE,
    });

    // Configuración de Coordinadora
    this.coordinadora = new CoordinadoraAdapter({
      url: process.env.COORDINADORA_URL || 'https://ff.coordinadora.com/',
      user: process.env.COORDINADORA_USER || '',
      password: process.env.COORDINADORA_PASSWORD || '',
    });

    // Configuración del flujo
    this.sourcePipeline = process.env.SOURCE_PIPELINE || 'logistica';
    this.sourceStage = process.env.SOURCE_STAGE || 'POR_DEFINIR';
    this.targetStage = process.env.TARGET_STAGE || 'COORDINADORA';
  }

  /**
   * Convertir datos de orden de Bigin a formato de Coordinadora
   */
  private mapOrderToGuiaInput(order: BiginOrder): CreateGuiaInput {
    return {
      nombreDestinatario: order.orderName || order.contactName || 'Sin nombre',
      telefonoDestinatario: order.telefono,
      direccionDestinatario: order.direccion,
      ciudadDestino: order.municipio,
      departamentoDestino: order.departamento,
      valorDeclarado: order.amount,
      contenido: order.description || 'Mercancía',
      referencia1: order.orderId, // Guardamos el ID de Bigin como referencia
      observaciones: `Orden Bigin: ${order.orderName}`,
    };
  }

  /**
   * Procesar una sola orden
   */
  async processOrder(order: BiginOrder): Promise<SyncResult> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📦 Procesando orden: ${order.orderName} (ID: ${order.orderId})`);
    console.log(`${'='.repeat(60)}`);

    try {
      // 1. Crear guía en Coordinadora
      const guiaInput = this.mapOrderToGuiaInput(order);
      console.log('\n📤 Creando guía en Coordinadora...');

      const guiaResult = await this.coordinadora.createGuia(guiaInput);

      if (!guiaResult.success || !guiaResult.numeroGuia) {
        return {
          biginOrderId: order.orderId,
          success: false,
          error: guiaResult.error || 'No se pudo crear la guía',
        };
      }

      console.log(`✅ Guía creada: ${guiaResult.numeroGuia}`);

      // 2. Actualizar orden en Bigin con el número de guía
      console.log('\n📝 Actualizando orden en Bigin...');
      const updateSuccess = await this.bigin.updateOrderWithGuia(
        order.orderId,
        guiaResult.numeroGuia,
        this.targetStage
      );

      if (!updateSuccess) {
        return {
          biginOrderId: order.orderId,
          numeroGuia: guiaResult.numeroGuia,
          success: false,
          error: 'Guía creada pero no se pudo actualizar Bigin',
        };
      }

      console.log(`✅ Orden actualizada en Bigin`);

      return {
        biginOrderId: order.orderId,
        numeroGuia: guiaResult.numeroGuia,
        newStage: this.targetStage,
        success: true,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error(`❌ Error procesando orden: ${errorMessage}`);
      return {
        biginOrderId: order.orderId,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Ejecutar sincronización completa
   */
  async sync(): Promise<SyncResult[]> {
    console.log('\n🚀 Iniciando sincronización Bigin → Coordinadora');
    console.log(`   Pipeline: ${this.sourcePipeline}`);
    console.log(`   Stage origen: ${this.sourceStage}`);
    console.log(`   Stage destino: ${this.targetStage}`);

    const results: SyncResult[] = [];

    try {
      // 1. Obtener órdenes de Bigin
      console.log('\n📋 Obteniendo órdenes de Bigin...');
      const orders = await this.bigin.getOrdersByStage(this.sourcePipeline, this.sourceStage);

      if (orders.length === 0) {
        console.log('ℹ️ No hay órdenes para procesar');
        return results;
      }

      console.log(`📦 ${orders.length} órdenes encontradas`);

      // 2. Procesar cada orden
      for (const order of orders) {
        const result = await this.processOrder(order);
        results.push(result);

        // Pequeña pausa entre órdenes
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // 3. Resumen
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      console.log('\n' + '='.repeat(60));
      console.log('📊 RESUMEN DE SINCRONIZACIÓN');
      console.log('='.repeat(60));
      console.log(`   ✅ Exitosas: ${successful}`);
      console.log(`   ❌ Fallidas: ${failed}`);
      console.log(`   📦 Total: ${results.length}`);

      return results;

    } catch (error) {
      console.error('❌ Error en sincronización:', error);
      throw error;

    } finally {
      // Cerrar browsers
      await this.close();
    }
  }

  async close(): Promise<void> {
    console.log('\n🔒 Cerrando conexiones...');
    await this.bigin.close();
    await this.coordinadora.close();
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const sync = new BiginCoordinadoraSync();
  sync.sync()
    .then(results => {
      console.log('\n✅ Sincronización completada');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}
