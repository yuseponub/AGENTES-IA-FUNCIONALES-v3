# Proactive Timers Manager - Documentación Técnica

## 📋 Resumen
**Workflow:** Proactive Timers Manager
**Función Principal:** Recordatorios y acciones automáticas por tiempo
**Tipo:** Cron Job + Procesador batch
**Trigger:** Cada 1 minuto

## 🎯 Propósito

El Proactive Timers Manager ejecuta acciones automáticas basadas en tiempo transcurrido:
1. **Recordatorio de datos (6 min):** Si el cliente está en `collecting_data` y no responde por 6 minutos, envía recordatorio.
2. **Crear orden sin promo (10 min):** Si el cliente tiene datos completos pero no eligió pack, crear orden con promo "WPP" después de 10 minutos.

## ⚠️ Estado Actual
**NOTA:** Este workflow está **parcialmente configurado** y requiere ajustes finales antes de activarse.

## 🔄 Flujo de Procesamiento

### 1. Trigger Cada Minuto
```
Schedule Trigger (Every Minute) - Cron: * * * * *
```

### 2. Query Sesiones Activas
```
Schedule → Query Active Sessions
```

**SQL Query:**
```sql
SELECT
  session_id,
  phone,
  mode,
  captured_data,
  last_activity,
  created_at
FROM sessions_v3
WHERE
  status = 'active'
  AND (
    mode = 'collecting_data'
    OR mode = 'ofrecer_promos'
    OR mode = 'bot_active'
  )
  AND last_activity > NOW() - INTERVAL '15 minutes'
ORDER BY last_activity DESC
```

**Filtros:**
- `status = 'active'` - Solo sesiones activas
- `mode IN ('collecting_data', 'ofrecer_promos', 'bot_active')` - Modos que necesitan seguimiento
- `last_activity > NOW() - 15min` - Actividad reciente (no sesiones antiguas)

### 3. IF: Any Sessions?
```
Query Active Sessions → IF: Any Sessions?
  ├─ TRUE → Analyze Sessions for Timers
  └─ FALSE → No Sessions - Skip
```

### 4. Analyze Sessions for Timers
```
Analyze Sessions for Timers
```

**Lógica de análisis:**
```javascript
const now = new Date();
const results = {
  data_reminders: [],
  pending_orders: []
};

sessions.forEach(session => {
  const state = session.captured_data || {};
  const mode = session.mode;
  const lastActivity = new Date(session.last_activity);
  const minutesSinceActivity = (now - lastActivity) / (1000 * 60);

  // 1️⃣ Check for data collection reminder (6 min)
  if (mode === 'collecting_data') {
    const reminderSent = state.reminder_sent || false;

    if (minutesSinceActivity >= 6 && !reminderSent) {
      results.data_reminders.push({
        phone: session.phone,
        session_id: session.session_id,
        captured_data: state,
        minutes_elapsed: minutesSinceActivity
      });
    }
  }

  // 2️⃣ Check for pending order creation (10 min)
  if (mode === 'ofrecer_promos' || mode === 'bot_active') {
    const minimumFields = ['nombre', 'apellido', 'telefono', 'direccion', 'ciudad', 'departamento'];
    const allMinimumComplete = minimumFields.every(f => state[f] && state[f].trim() !== '');
    const hasPromo = state.promo && state.promo !== 'WPP' && state.promo.trim() !== '';
    const orderCreated = state.order_created || false;

    if (allMinimumComplete && !hasPromo && !orderCreated) {
      if (minutesSinceActivity >= 10) {
        results.pending_orders.push({
          phone: session.phone,
          session_id: session.session_id,
          captured_data: state,
          minutes_elapsed: minutesSinceActivity
        });
      }
    }
  }
});

return results;
```

### 5. Prepare Actions
```
Analyze → Prepare Actions
```

**Preparar recordatorios de datos:**
```javascript
data.data_reminders.forEach(session => {
  const state = session.captured_data || {};
  const allFields = ['nombre', 'apellido', 'telefono', 'direccion', 'barrio', 'departamento', 'ciudad', 'correo'];
  const missingFields = allFields.filter(f => !state[f] || state[f] === '');

  const fieldNames = {
    'nombre': 'nombre completo',
    'apellido': 'apellido',
    'telefono': 'número de teléfono',
    'direccion': 'dirección completa',
    'barrio': 'barrio',
    'ciudad': 'ciudad o municipio',
    'departamento': 'departamento',
    'correo': 'correo electrónico'
  };

  let message = '¡Hola! 👋\n\n';
  message += 'Para completar tu pedido, necesitamos los siguientes datos:\n\n';
  missingFields.forEach((field, index) => {
    message += `${index + 1}. ${fieldNames[field]}\n`;
  });
  message += '\nPor favor envíalos para continuar con tu orden. ¡Gracias! 😊';

  actions.data_reminders.push({
    phone: session.phone,
    session_id: session.session_id,
    message: message,
    missing_fields: missingFields,
    action_type: 'data_reminder'
  });
});
```

**Preparar órdenes pendientes:**
```javascript
data.pending_orders.forEach(session => {
  const state = session.captured_data || {};

  const orderBody = {
    ordenName: `${state.nombre} ${state.apellido} - WPP`.trim(),
    stage: 'Nuevo Ingreso',
    closingDate: '17/01/2026',  // Fecha actual
    amount: 0,  // Sin promo
    telefono: state.telefono,
    direccion: state.direccion,
    municipio: state.ciudad,
    departamento: state.departamento,
    email: state.correo || '',
    description: 'WPP'  // WPP = WhatsApp without promo
  };

  actions.pending_orders.push({
    phone: session.phone,
    session_id: session.session_id,
    order_body: orderBody,
    captured_data: state,
    action_type: 'create_order'
  });
});
```

### 6. Split Into Branches
```
Prepare Actions → Split Into Branches (splitInBatches)
```
Divide en dos branches:
- data_reminders
- pending_orders

### 7. Branch 1: Data Reminders
```
Loop: Data Reminders → Prepare Callbell Message → Send Reminder → Mark Reminder Sent
```

**Send Reminder to Callbell:**
```json
POST https://api.callbell.eu/v1/messages/send

{
  "to": "57...",
  "from": "whatsapp",
  "type": "text",
  "content": {
    "text": "¡Hola! Para completar tu pedido..."
  }
}
```

**Mark Reminder Sent:**
```sql
UPDATE sessions_v3
SET captured_data = jsonb_set(
  COALESCE(captured_data, '{}'::jsonb),
  '{reminder_sent}',
  'true'::jsonb
)
WHERE phone = '{{phone}}'
```

### 8. Branch 2: Pending Orders
```
Loop: Pending Orders → Prepare Order Manager Body → Call Order Manager
```

**Call Order Manager:**
```json
POST http://localhost:5678/webhook/order-manager

{
  "phone": "57...",
  "captured_data": {...},
  "promo_override": "WPP",
  "source": "proactive_timers"
}
```

## 🎯 Acciones Automáticas

### 1️⃣ Recordatorio de Datos (6 minutos)

**Condiciones:**
- `mode === 'collecting_data'`
- `minutesSinceActivity >= 6`
- `reminder_sent === false` (solo una vez)

**Acción:**
- Envía mensaje a Callbell con campos faltantes
- Marca `reminder_sent = true`

**Ejemplo de mensaje:**
```
¡Hola! 👋

Para completar tu pedido, necesitamos los siguientes datos:

1. dirección completa
2. ciudad o municipio
3. departamento

Por favor envíalos para continuar con tu orden. ¡Gracias! 😊
```

### 2️⃣ Crear Orden sin Promo (10 minutos)

**Condiciones:**
- `mode === 'ofrecer_promos' OR mode === 'bot_active'`
- Campos mínimos completos (nombre, apellido, telefono, direccion, ciudad, departamento)
- `hasPromo === false` (no eligió 1x/2x/3x)
- `order_created === false`
- `minutesSinceActivity >= 10`

**Acción:**
- Llama Order Manager con `promo_override: "WPP"`
- Crea orden en Bigin con amount: 0
- Marca `order_created = true`

## ⏱️ Timeline de Acciones

```
t=0: Cliente envía último mensaje
  ↓
t=6min: ⚠️ Sin respuesta + collecting_data
        → Envía recordatorio de datos faltantes
  ↓
t=10min: ⚠️ Sin respuesta + datos completos sin pack
         → Crea orden automáticamente con promo "WPP"
```

## 🎯 Casos de Uso

### Caso 1: Recordatorio de Datos
```
t=0: Cliente: "Quiero comprar"
     Bot activa collecting_data
     Cliente proporciona: nombre, apellido, telefono
     Cliente no responde más

t=6min: Proactive Timer detecta:
        - mode = collecting_data
        - minutesSinceActivity = 6
        - reminder_sent = false
        - Missing: direccion, ciudad, departamento

        Acción: Envía recordatorio
        Marca: reminder_sent = true
```

### Caso 2: Orden sin Promo
```
t=0: Cliente completa todos los datos
     Bot ofrece promos (1x/2x/3x)
     Cliente no responde (no elige pack)

t=10min: Proactive Timer detecta:
         - mode = ofrecer_promos
         - minutesSinceActivity = 10
         - allMinimumComplete = true
         - hasPromo = false
         - order_created = false

         Acción: Crea orden con WPP
         Marca: order_created = true
```

### Caso 3: Cliente Responde Antes de Timer
```
t=0: Cliente en collecting_data
t=4min: Cliente envía más datos
        → last_activity actualizado
        → minutesSinceActivity = 0 (reinicia)
        → Timer NO se activa

t=10min total: minutesSinceActivity = 6min desde última actividad
               → Timer se activa normalmente
```

## ⚙️ Configuración

### Cron Expression
```
* * * * *
```
**Significado:** Cada minuto

### Credenciales n8n
- **Postgres:** `Postgres Historial v3`
- **Callbell API:** Header Auth con Bearer token

### Timeouts
- **Order Manager:** 30 segundos
- **Send to Callbell:** Default

## 📊 Parámetros Configurables

### Timers
```javascript
const DATA_REMINDER_MINUTES = 6;
const PENDING_ORDER_MINUTES = 10;
const MAX_SESSION_AGE_MINUTES = 15;
```

### Campos Requeridos
```javascript
const MINIMUM_FIELDS = ['nombre', 'apellido', 'telefono', 'direccion', 'ciudad', 'departamento'];
const ALL_FIELDS = [...MINIMUM_FIELDS, 'barrio', 'correo'];
```

## 🚨 Pendientes de Configuración

### 1. Ajustar Timers
- [ ] Validar 6 minutos para recordatorio
- [ ] Validar 10 minutos para orden automática
- [ ] Considerar timezone (Colombia UTC-5)

### 2. Testing
- [ ] Probar recordatorio de datos
- [ ] Probar creación de orden automática
- [ ] Verificar que no envía duplicados

### 3. Mejoras
- [ ] Agregar notificación a equipo cuando orden automática
- [ ] Log detallado de acciones ejecutadas
- [ ] Dashboard de métricas de timers

## 📈 Métricas y Logs

### Console Logs
- `⏱️ CHECKING SESSIONS FOR TIMER ACTIONS` - Inicio de análisis
- `→ Needs data collection reminder` - Recordatorio detectado
- `→ Needs order creation without promo` - Orden pendiente detectada
- `📈 SUMMARY: X reminders, Y orders` - Resumen de acciones

## 🚨 Errores Comunes

### Error: "No sessions found"
**Causa:** No hay sesiones activas en los últimos 15 minutos
**Solución:** Normal, workflow termina

### Error: "Reminder already sent"
**Causa:** `reminder_sent === true`
**Solución:** Correctoevita duplicados

### Error: "Order already created"
**Causa:** `order_created === true`
**Solución:** Correcto, evita duplicados

## 🔗 Dependencias

**Proactive Timers depende de:**
- PostgreSQL (sessions_v3)
- Callbell API (enviar recordatorios)
- Order Manager (crear órdenes)

**Workflows que dependen de Proactive Timers:**
- Ninguno (ejecuta de forma independiente)

## 📝 Notas Importantes

1. **Cron cada minuto:** Revisa constantemente
2. **Idempotencia:** Flags reminder_sent y order_created evitan duplicados
3. **Window de 15 minutos:** Solo revisa sesiones activas recientes
4. **Promo WPP:** Indica "WhatsApp sin promo seleccionada"
5. **Una sola vez:** Cada acción se ejecuta máximo 1 vez por sesión
6. **No interrumpe conversaciones activas:** Solo actúa después de inactividad
7. **⚠️ Requiere activación manual:** Verificar configuración antes de activar
