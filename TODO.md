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

### 4. 🤖 Actualizar Robot de Bigin

**Estado:** ✅ COMPLETADO - 17 Enero 2026

**Repositorio:** https://github.com/yuseponub/somnio/tree/main/bigin-robot
**Documentación Completa:** `/root/proyectos/somnio/bigin-robot/docs/NUEVAS-FUNCIONALIDADES.md`

**Todas las funcionalidades implementadas exitosamente:**

#### a) Sistema de Relogin Automático
- [x] Verificar si está loggeado antes de cada operación
- [x] Si no está loggeado → hacer login automático
- [x] Guardar cookies/session en archivo o variable
- [x] Timeout de sesión: 30 minutos sin actividad → relogin

#### b) Verificar y Abrir Ventanas Cerradas
- [x] Verificar si la ventana del navegador está cerrada
- [x] Si está cerrada → reiniciar navegador y hacer login
- [x] Verificar que esté en el dominio correcto (Bigin/Zoho)

#### c) Integración del Link de Callbell
- [x] Agregar campo `callBell` al crear orden
- [x] Campo debe ser clickeable en Bigin
- [x] Verificar que se guarda correctamente

#### d) Manejo de Errores y Reintentos
- [x] Implementar retry con backoff exponencial (1s, 2s, 4s)
- [x] Si falla 3 veces → notificar a equipo (placeholder implementado)
- [x] Log detallado de cada intento

#### e) Extras Implementados
- [x] Retorno de Order ID y URL después de crear orden
- [x] Sistema de refresh de timestamp de sesión
- [x] Verificación de UI de Bigin presente

**Resumen de Implementación:**

```typescript
// Métodos principales implementados:
- isWindowClosed(): Detecta ventanas cerradas o sesiones perdidas
- ensureValidSession(): Garantiza sesión válida antes de operaciones
- retryWithBackoff(): Retry automático con backoff exponencial
- notifyTeam(): Notificaciones al equipo (placeholder para Slack/Email)
- createOrder(): Retorna { orderId, orderUrl }
```

**Archivos modificados:**
- `packages/robot-base/src/session-manager.ts` (timeout 30min)
- `packages/adapters/bigin/src/bigin-adapter.ts` (todas las funcionalidades)
- `docs/NUEVAS-FUNCIONALIDADES.md` (documentación completa)

**Compilación:** ✅ Sin errores
**Backup:** `backups/bigin-adapter-WITH-ALL-FEATURES-20260117-152548.ts`
**Commit:** `aaff662` - Pushed to GitHub

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
