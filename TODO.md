# 📋 Lista de Tareas Pendientes - Sistema v3DSL

## 🚀 Tareas Prioritarias

### 1. ⚠️ Configurar y Activar Proactive Timers
**Estado:** ⚠️ PENDIENTE - NO ACTIVAR hasta configurar

**Sub-tareas:**
- [ ] Validar timers (6 min para recordatorio, 10 min para orden auto)
- [ ] Ajustar para timezone Colombia (UTC-5)
- [ ] Probar recordatorio de datos en ambiente de testing
- [ ] Probar creación automática de orden sin promo
- [ ] Verificar que no envía duplicados (flags reminder_sent, order_created)
- [ ] Agregar logs detallados de acciones ejecutadas
- [ ] Agregar notificación a equipo cuando se cree orden automática
- [ ] Activar workflow después de validación completa

**Archivos afectados:**
- `workflows/07-proactive-timers.json`
- `docs/07-PROACTIVE-TIMERS.md`

---

### 2. 🎯 Completar Intents Faltantes

**Estado:** PENDIENTE

**Intents que faltan configurar:**

#### a) State Analyzer
- [ ] Revisar y refinar prompts de detección
- [ ] Agregar más ejemplos de contexto para "sí/no"
- [ ] Mejorar detección de negaciones
- [ ] Agregar intent para cambios de pedido
- [ ] Agregar intent para cancelaciones
- [ ] Agregar intent para consultas de seguimiento

**Archivos afectados:**
- `workflows/03-state-analyzer.json` (nodo "Prepare Claude Messages")

#### b) Select Templates (Carolina v3)
- [ ] Agregar plantillas para intents nuevos
- [ ] Revisar y optimizar delays entre mensajes
- [ ] Agregar variaciones de respuestas para evitar repetición
- [ ] Configurar respuestas para cambios de pedido
- [ ] Configurar respuestas para cancelaciones
- [ ] Configurar respuestas para seguimiento

**Archivos afectados:**
- `/files/plantillas/mensajes.json`
- `/files/plantillas/intents.json`
- `workflows/02-carolina-v3.json` (nodo "Select Templates")

---

### 3. 📍 Implementar Funcionalidad de Directorio (Tiempos de Entrega)

**Estado:** 🆕 NUEVO - ALTA PRIORIDAD

**Objetivo:** Calcular y mostrar tiempos de entrega aproximados con día de la semana según municipio.

**Requisitos:**
- Base de datos de municipios con tiempos de entrega
- Lógica para calcular día de entrega considerando:
  - Día actual
  - Municipio destino
  - Días hábiles (lunes-viernes)
  - Fines de semana
  - Festivos (opcional)

**Implementación sugerida:**

#### a) Crear Tabla de Directorio
```sql
CREATE TABLE directorio_municipios (
  id SERIAL PRIMARY KEY,
  departamento VARCHAR NOT NULL,
  municipio VARCHAR NOT NULL,
  dias_entrega INTEGER NOT NULL,  -- Días hábiles de entrega
  cobertura BOOLEAN DEFAULT true,
  notas TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_municipio ON directorio_municipios(municipio);
CREATE INDEX idx_departamento ON directorio_municipios(departamento);

-- Ejemplo de datos
INSERT INTO directorio_municipios (departamento, municipio, dias_entrega) VALUES
  ('Antioquia', 'Medellín', 2),
  ('Bogotá D.C.', 'Bogotá', 1),
  ('Valle del Cauca', 'Cali', 3),
  ('Atlántico', 'Barranquilla', 4);
```

#### b) Crear Workflow: Delivery Calculator
- [ ] Crear nuevo workflow `delivery-calculator`
- [ ] Endpoint: `POST /webhook/delivery-calculator`
- [ ] Input: `{ciudad, departamento}`
- [ ] Lógica:
  ```javascript
  // Consultar tabla directorio_municipios
  const municipio = await query(`
    SELECT dias_entrega, cobertura
    FROM directorio_municipios
    WHERE municipio = '${ciudad}'
      AND departamento = '${departamento}'
  `);

  // Calcular día de entrega
  const hoy = new Date();
  let diaEntrega = hoy;
  let diasHabiles = 0;

  while (diasHabiles < municipio.dias_entrega) {
    diaEntrega.setDate(diaEntrega.getDate() + 1);
    const diaSemana = diaEntrega.getDay();

    // Si es día hábil (lunes-viernes)
    if (diaSemana !== 0 && diaSemana !== 6) {
      diasHabiles++;
    }
  }

  // Formatear respuesta
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const diaNombre = diasSemana[diaEntrega.getDay()];

  return {
    ciudad: ciudad,
    departamento: departamento,
    dias_habiles: municipio.dias_entrega,
    fecha_estimada: diaEntrega.toISOString().split('T')[0],
    dia_semana: diaNombre,
    cobertura: municipio.cobertura,
    mensaje: `Entrega estimada: ${diaNombre} ${diaEntrega.getDate()}/${diaEntrega.getMonth()+1}`
  };
  ```

#### c) Integrar con State Analyzer e Historial
- [ ] Agregar intent `consulta_envio` o mejorar intent `envio`
- [ ] Llamar Delivery Calculator cuando se detecte ciudad y departamento
- [ ] Guardar tiempo de entrega en state
- [ ] Usar en plantillas: `"Tu pedido llegará el {{dia_entrega}}"`

#### d) Agregar a Carolina v3
- [ ] Crear plantillas con variables de entrega:
  ```json
  {
    "/confirmacion_con_entrega": {
      "texto": "Perfecto, {{nombre}}! Tu pedido llegará aproximadamente el {{dia_entrega}}. ¿Confirmas tu compra?",
      "delay_s": 2
    }
  }
  ```
- [ ] Reemplazar variables en Select Templates

#### e) Poblar Base de Datos
- [ ] Agregar todos los municipios principales de Colombia
- [ ] Definir tiempos de entrega realistas
- [ ] Marcar municipios sin cobertura
- [ ] Agregar notas especiales (ej: "zona rural +1 día")

**Archivos nuevos:**
- `workflows/08-delivery-calculator.json`
- `docs/08-DELIVERY-CALCULATOR.md`
- `sql/directorio_municipios.sql`

**Archivos afectados:**
- `workflows/01-historial-v3.json` (agregar llamada a delivery calculator)
- `workflows/02-carolina-v3.json` (agregar reemplazo de variables)
- `/files/plantillas/mensajes.json` (agregar templates con entrega)

---

### 4. 🤖 Actualizar Robot de Bigin (CRÍTICO)

**Estado:** 🔥 URGENTE

**Funcionalidades faltantes a implementar:**

#### a) Sistema de Relogin Automático
- [ ] Verificar si está loggeado antes de cada operación
- [ ] Si no está loggeado → hacer login automático
- [ ] Guardar cookies/session en archivo o variable
- [ ] Timeout de sesión: 30 minutos sin actividad → relogin

**Código sugerido:**
```javascript
const puppeteer = require('puppeteer');
const fs = require('fs');

class BiginRobot {
  constructor() {
    this.browser = null;
    this.page = null;
    this.sessionFile = './bigin-session.json';
    this.lastActivity = null;
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutos
  }

  async isSessionValid() {
    if (!this.lastActivity) return false;
    const now = Date.now();
    return (now - this.lastActivity) < this.sessionTimeout;
  }

  async ensureLoggedIn() {
    if (!await this.isSessionValid()) {
      console.log('⚠️ Sesión expirada o no existe, haciendo relogin...');
      await this.login();
    } else {
      console.log('✅ Sesión válida, usando sesión existente');
    }
  }

  async login() {
    try {
      if (!this.browser) {
        this.browser = await puppeteer.launch({ headless: true });
        this.page = await this.browser.newPage();
      }

      // Intentar cargar cookies guardadas
      if (fs.existsSync(this.sessionFile)) {
        const cookies = JSON.parse(fs.readFileSync(this.sessionFile));
        await this.page.setCookie(...cookies);
        console.log('📂 Cookies cargadas desde archivo');
      }

      // Navegar a Bigin
      await this.page.goto('https://bigin.zoho.com/');
      await this.page.waitForTimeout(2000);

      // Verificar si ya está loggeado
      const isLoggedIn = await this.checkIfLoggedIn();

      if (!isLoggedIn) {
        console.log('🔐 No está loggeado, iniciando sesión...');

        // Login form
        await this.page.waitForSelector('#login_id');
        await this.page.type('#login_id', process.env.BIGIN_EMAIL);
        await this.page.click('#nextbtn');
        await this.page.waitForTimeout(1000);

        await this.page.waitForSelector('#password');
        await this.page.type('#password', process.env.BIGIN_PASSWORD);
        await this.page.click('#nextbtn');
        await this.page.waitForTimeout(3000);

        // Guardar cookies
        const cookies = await this.page.cookies();
        fs.writeFileSync(this.sessionFile, JSON.stringify(cookies));
        console.log('✅ Login exitoso, cookies guardadas');
      }

      this.lastActivity = Date.now();
      return true;
    } catch (error) {
      console.error('❌ Error en login:', error);
      return false;
    }
  }

  async checkIfLoggedIn() {
    try {
      // Verificar si estamos en dashboard o página de login
      const url = this.page.url();
      return url.includes('/crm/') || url.includes('/bigin/');
    } catch (error) {
      return false;
    }
  }
}
```

#### b) Verificar y Abrir Ventanas Cerradas
- [ ] Verificar si la ventana de órdenes está abierta
- [ ] Si está cerrada → navegar y abrirla
- [ ] Verificar que esté en la vista correcta (Orders)

**Código sugerido:**
```javascript
async ensureOrdersViewOpen() {
  try {
    // Verificar URL actual
    const currentUrl = this.page.url();

    if (!currentUrl.includes('/Orders/')) {
      console.log('📂 Ventana de Orders cerrada, abriendo...');

      // Navegar a Orders
      await this.page.goto('https://bigin.zoho.com/crm/org.../tab/Potentials');
      await this.page.waitForTimeout(2000);

      // Verificar que cargó correctamente
      const isOrdersView = await this.page.$('.moduleTab');
      if (!isOrdersView) {
        throw new Error('No se pudo abrir la vista de Orders');
      }

      console.log('✅ Vista de Orders abierta');
    }

    this.lastActivity = Date.now();
  } catch (error) {
    console.error('❌ Error abriendo ventana de Orders:', error);
    throw error;
  }
}
```

#### c) Integración del Link de Callbell
- [ ] Agregar campo `callbell_conversation_href` al crear orden
- [ ] Campo debe ser clickeable en Bigin
- [ ] Verificar que se guarda correctamente

**Código actual a modificar:**
```javascript
async createOrder(orderData) {
  await this.ensureLoggedIn();
  await this.ensureOrdersViewOpen();

  try {
    // Click en "New Order"
    await this.page.click('[data-action="new"]');
    await this.page.waitForTimeout(1000);

    // Llenar campos
    await this.page.type('#ordenName', orderData.ordenName);
    await this.page.select('#stage', orderData.stage);
    await this.page.type('#closingDate', orderData.closingDate);
    await this.page.type('#amount', orderData.amount.toString());
    await this.page.type('#telefono', orderData.telefono);
    await this.page.type('#direccion', orderData.direccion);
    await this.page.type('#municipio', orderData.municipio);
    await this.page.type('#departamento', orderData.departamento);
    await this.page.type('#email', orderData.email);
    await this.page.type('#description', orderData.description);

    // 🆕 AGREGAR: Campo de Callbell (link clickeable)
    if (orderData.callBell) {
      await this.page.type('#callBell', orderData.callBell);
      console.log('🔗 Callbell link agregado:', orderData.callBell);
    }

    // Guardar
    await this.page.click('[data-action="save"]');
    await this.page.waitForTimeout(2000);

    // Obtener ID y URL de la orden creada
    const orderUrl = this.page.url();
    const orderId = orderUrl.match(/\/(\d+)$/)?.[1];

    this.lastActivity = Date.now();

    return {
      success: true,
      orderId: orderId,
      orderUrl: orderUrl,
      ordenName: orderData.ordenName
    };
  } catch (error) {
    console.error('❌ Error creando orden:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

#### d) Manejo de Errores y Reintentos
- [ ] Implementar retry con backoff exponencial
- [ ] Si falla 3 veces → notificar a equipo
- [ ] Log detallado de cada intento

**Código sugerido:**
```javascript
async createOrderWithRetry(orderData, maxRetries = 3) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log(`📤 Intento ${attempt + 1}/${maxRetries} de crear orden`);

      const result = await this.createOrder(orderData);

      if (result.success) {
        console.log('✅ Orden creada exitosamente:', result.ordenName);
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      attempt++;
      console.error(`❌ Intento ${attempt} falló:`, error.message);

      if (attempt >= maxRetries) {
        console.error('🚨 CRÍTICO: No se pudo crear orden después de', maxRetries, 'intentos');

        // TODO: Notificar a equipo (Slack, email, etc.)
        await this.notifyTeam({
          error: error.message,
          orderData: orderData,
          attempts: maxRetries
        });

        return {
          success: false,
          error: error.message,
          attempts: maxRetries
        };
      }

      // Backoff exponencial: 2^attempt segundos
      const waitTime = Math.pow(2, attempt) * 1000;
      console.log(`⏳ Esperando ${waitTime/1000}s antes de reintentar...`);
      await this.page.waitForTimeout(waitTime);

      // Intentar relogin antes de retry
      await this.login();
    }
  }
}

async notifyTeam(data) {
  // TODO: Implementar notificación (Slack, Discord, Email, etc.)
  console.log('📧 NOTIFICACIÓN A EQUIPO:', JSON.stringify(data, null, 2));
}
```

**Archivos afectados:**
- `robot-api/src/bigin/bigin-robot.js` (o similar)
- `robot-api/src/routes/bigin.js`
- `robot-api/.env` (agregar BIGIN_EMAIL, BIGIN_PASSWORD)

---

## 🔧 Tareas de Mantenimiento

### 5. 📚 Mejorar Plantillas de Respuestas
**Estado:** MEJORA CONTINUA

- [ ] Revisar todas las plantillas actuales
- [ ] Agregar variaciones para evitar repetición
- [ ] Optimizar delays según longitud de mensaje
- [ ] Agregar emojis estratégicamente
- [ ] A/B testing de respuestas

**Archivos afectados:**
- `/files/plantillas/mensajes.json`
- `/files/plantillas/intents.json`

---

### 6. 🎨 Mejorar Templates de Callbell (Imágenes)
**Estado:** OPCIONAL

- [ ] Diseñar nuevos templates visuales
- [ ] Actualizar template de promos con precios actualizados
- [ ] Crear template para seguimiento de pedido
- [ ] Subir a Callbell y obtener UUIDs
- [ ] Actualizar `mensajes.json` con nuevos UUIDs

---

### 7. 📊 Implementar Analytics y Métricas
**Estado:** FUTURO

- [ ] Dashboard de métricas en tiempo real
- [ ] Tasa de conversión por etapa
- [ ] Tiempo promedio de conversación
- [ ] Intents más comunes
- [ ] Abandono por etapa
- [ ] Errores de API (Claude, Callbell, Bigin)
- [ ] Integración con Google Analytics o Mixpanel

**Posible implementación:**
- Crear tabla `analytics_events`
- Agregar tracking en cada workflow
- Dashboard con Grafana o similar

---

### 8. 🔔 Sistema de Notificaciones
**Estado:** FUTURO

- [ ] Notificar a equipo cuando orden creada
- [ ] Notificar cuando error crítico
- [ ] Notificar cuando cliente abandona en paso clave
- [ ] Integración con Slack/Discord/Email

---

### 9. 🧪 Testing Automatizado
**Estado:** FUTURO

- [ ] Tests unitarios para cada nodo crítico
- [ ] Tests de integración end-to-end
- [ ] Tests de carga (múltiples conversaciones simultáneas)
- [ ] Tests de recuperación ante fallos

---

### 10. 📖 Documentación de Usuario Final
**Estado:** FUTURO

- [ ] Manual para operadores
- [ ] Guía de troubleshooting común
- [ ] Casos de uso documentados
- [ ] FAQs

---

## 🏁 Criterios de Completitud

### Para considerar el sistema 100% funcional:

- [x] Historial v3 funcionando
- [x] Carolina v3 respondiendo
- [x] State Analyzer detectando intents
- [x] Data Extractor capturando datos
- [x] Order Manager creando órdenes
- [x] Snapshot retornando estado
- [ ] ⚠️ Proactive Timers configurado y probado
- [ ] 🎯 Intents faltantes implementados
- [ ] 📍 Directorio de municipios funcionando
- [ ] 🤖 Robot de Bigin con relogin y link de Callbell

---

## 📅 Cronograma Sugerido

### Semana 1 (URGENTE)
- [ ] Día 1-2: Actualizar Robot de Bigin (relogin, ventanas, link)
- [ ] Día 3-4: Configurar Proactive Timers
- [ ] Día 5: Testing completo de flujo end-to-end

### Semana 2 (ALTA PRIORIDAD)
- [ ] Día 1-3: Implementar Directorio de Municipios
- [ ] Día 4-5: Completar intents faltantes

### Semana 3 (MEJORAS)
- [ ] Optimizar plantillas
- [ ] Agregar variaciones de respuestas
- [ ] Implementar analytics básico

---

## 🐛 Bugs Conocidos

- Ninguno reportado aún

---

## 💡 Ideas Futuras

- [ ] Soporte multi-idioma (inglés)
- [ ] Soporte para otros canales (Instagram, Facebook, Telegram)
- [ ] Chatbot de FAQ sin necesidad de agente humano
- [ ] Integración con WhatsApp Business API directo
- [ ] Recomendaciones personalizadas basadas en historial

---

**Última actualización:** 17 de Enero 2026
**Responsable:** Claude Code + yuseponub
