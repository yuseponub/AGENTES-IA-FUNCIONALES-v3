# 🚀 Guía de Implementación Completa - Sistema de Órdenes Automatizado

## 📋 Resumen Ejecutivo

Este sistema conecta:
- **CallBell/WhatsApp** → Cliente hace pedido
- **n8n Workflow Conversacional** → IA extrae datos
- **n8n Workflow Validación** → Limpia y valida datos
- **n8n Workflow Sincronización** → Guarda en PostgreSQL + Bigin
- **PostgreSQL** → Base de datos central
- **Robot API** → Interfaz con Bigin CRM
- **Bigin CRM** → Sistema de gestión de órdenes

---

## ✅ Checklist - Lo que ya está listo

- [x] Base de datos PostgreSQL configurada
- [x] Tablas: `sessions`, `messages`, `orders`, `actions_log`
- [x] Robot API funcionando en `localhost:3000`
- [x] BiginAdapter con función `createOrder`
- [x] 1,443 sesiones conversacionales existentes

---

## 🎯 Arquitectura Final

```
┌────────────────────────────────────────────────────┐
│  1. Cliente envía mensaje por WhatsApp            │
└─────────────────┬──────────────────────────────────┘
                  ↓
┌────────────────────────────────────────────────────┐
│  2. WORKFLOW CONVERSACIONAL (n8n)                  │
│  ─────────────────────────────────────────────     │
│  • CallBell Trigger                                │
│  • IA Claude extrae intención                      │
│  • IA extrae: nombre, teléfono, dirección, etc.    │
│  • Guarda en: sessions + messages (PostgreSQL)     │
│  • Responde al cliente                             │
└─────────────────┬──────────────────────────────────┘
                  ↓ Trigger Workflow
┌────────────────────────────────────────────────────┐
│  3. WORKFLOW VALIDACIÓN (n8n) ⭐ NUEVO             │
│  ─────────────────────────────────────────────     │
│  • Normaliza mayúsculas                            │
│  • Formatea teléfono (57300... sin +)              │
│  • Valida email, campos requeridos                 │
│  • Prepara payload para Bigin                      │
└─────────────────┬──────────────────────────────────┘
                  ↓ Trigger Workflow
┌────────────────────────────────────────────────────┐
│  4. WORKFLOW SINCRONIZACIÓN (n8n) ⭐ NUEVO         │
│  ─────────────────────────────────────────────     │
│  • INSERT en orders (PostgreSQL) ✅                │
│  • POST a Robot API /bigin/create-order ✅         │
│  • UPDATE orders con bigin_order_id ✅             │
│  • INSERT en actions_log ✅                        │
│  • Notifica al cliente resultado ✅                │
└─────────────────┬──────────────────────────────────┘
                  ↓
┌────────────────────────────────────────────────────┐
│  5. ROBOT API → BiginAdapter → Zoho Bigin CRM     │
└────────────────────────────────────────────────────┘
```

---

## 🔧 Paso a Paso - Implementación

### ✅ PASO 1: Base de Datos (YA HECHO)

```sql
-- Ya ejecutado:
✅ Columnas agregadas a orders: bigin_order_id, synced_to_bigin, sync_error
✅ Tabla actions_log creada
✅ Índices creados para performance
```

### ✅ PASO 2: Robot API (YA FUNCIONANDO)

```bash
# Verificar que está corriendo:
curl http://localhost:3000/health

# Si no está corriendo, iniciarlo:
cd /home/n8n-claude/proyectos/modelo-ia-distribuida/packages/robot-api
npm start &
```

### 🔨 PASO 3: Crear Workflow de Validación en n8n

1. **Abrir n8n**
2. **Crear nuevo workflow**
3. **Nombrar:** "Validación de Datos de Orden"

**Nodos a agregar:**

#### Nodo 1: Webhook
- **Method:** POST
- **Path:** `validate-order-data`
- **Response Mode:** Last Node

#### Nodo 2: Code (Function)
```javascript
// Funciones de normalización
const normalizeName = (name) => {
  if (!name) return '';
  return name.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const normalizePhone = (phone) => {
  if (!phone) return '';
  return phone.replace(/[\s+-]/g, '');
};

const normalizeEmail = (email) => {
  if (!email) return '';
  return email.toLowerCase().trim();
};

const normalizeCity = (city) => {
  if (!city) return '';
  return city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
};

// Procesar datos
const input = $input.first().json;

return {
  json: {
    session_id: input.session_id,
    customer_name: normalizeName(input.customer_name),
    phone: normalizePhone(input.phone),
    email: normalizeEmail(input.email),
    address: input.address,
    city: normalizeCity(input.city),
    department: normalizeCity(input.department),
    pack: input.pack,
    price: parseInt(input.price) || 0,
    status: 'pending'
  }
};
```

#### Nodo 3: IF - Validar Datos
**Conditions:**
- `{{ $json.customer_name }}` is not empty
- `{{ $json.phone }}` is not empty
- `{{ $json.price }}` > 0

**TRUE branch:** Continuar a sincronización
**FALSE branch:** Log error

#### Nodo 4: Execute Workflow (TRUE branch)
- **Source:** Workflow
- **Workflow:** Selecciona "Sincronización PostgreSQL + Bigin"

**Activar workflow** y copiar el webhook URL

---

### 🔨 PASO 4: Crear Workflow de Sincronización en n8n

1. **Crear nuevo workflow**
2. **Nombrar:** "Sincronización PostgreSQL + Bigin"

**Nodos a agregar:**

#### Nodo 1: Webhook o Execute Workflow Trigger
- Si usas Webhook: POST
- Si usas Execute Workflow: automático

#### Nodo 2: PostgreSQL - INSERT Order
- **Operation:** Execute Query
- **Query:**
```sql
INSERT INTO orders (
  session_id, customer_name, phone, email,
  address, city, department, pack, price, status, created_at
) VALUES (
  '{{ $json.session_id }}',
  '{{ $json.customer_name }}',
  '{{ $json.phone }}',
  '{{ $json.email }}',
  '{{ $json.address }}',
  '{{ $json.city }}',
  '{{ $json.department }}',
  '{{ $json.pack }}',
  {{ $json.price }},
  'pending',
  NOW()
) RETURNING *;
```

#### Nodo 3: Code - Preparar Payload Bigin
```javascript
const order = $input.first().json;
const today = new Date();
const closingDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

return {
  json: {
    order_id: order.id,
    session_id: order.session_id,
    customer_name: order.customer_name,
    bigin_payload: {
      ordenName: `Orden #${order.id} - ${order.customer_name}`,
      subPipeline: 'Ventas Somnio Standard',
      stage: 'Nuevo Ingreso',
      closingDate: closingDate,
      amount: order.price,
      telefono: order.phone,
      direccion: order.address,
      municipio: order.city,
      departamento: order.department,
      email: order.email || '',
      description: 'WPP'
    }
  }
};
```

#### Nodo 4: HTTP Request - Robot API
- **Method:** POST
- **URL:** `http://localhost:3000/bigin/create-order`
- **Body Content Type:** JSON
- **Body:**
```json
{{ $json.bigin_payload }}
```
- **Options → Timeout:** 60000

#### Nodo 5: IF - Check Success
**Condition:** `{{ $json.success }}` equals `true`

#### Nodo 6a: PostgreSQL - Update Success (TRUE branch)
```sql
UPDATE orders
SET synced_to_bigin = TRUE,
    bigin_order_id = '{{ $json.data.ordenName }}',
    last_sync_at = NOW()
WHERE id = {{ $('Code').first().json.order_id }};
```

#### Nodo 6b: PostgreSQL - Update Error (FALSE branch)
```sql
UPDATE orders
SET sync_error = '{{ $json.error }}',
    last_sync_at = NOW()
WHERE id = {{ $('Code').first().json.order_id }};
```

#### Nodo 7a: PostgreSQL - Log Success (TRUE branch)
```sql
INSERT INTO actions_log (
  session_id, order_id, action_type,
  action_data, success, workflow_name, created_at
) VALUES (
  '{{ $('Code').first().json.session_id }}',
  {{ $('Code').first().json.order_id }},
  'bigin_order_created',
  '{{ JSON.stringify($json) }}',
  TRUE,
  'sync-bigin',
  NOW()
);
```

#### Nodo 7b: PostgreSQL - Log Error (FALSE branch)
```sql
INSERT INTO actions_log (
  session_id, order_id, action_type,
  action_data, success, error_message, workflow_name, created_at
) VALUES (
  '{{ $('Code').first().json.session_id }}',
  {{ $('Code').first().json.order_id }},
  'bigin_order_failed',
  '{{ JSON.stringify($json) }}',
  FALSE,
  '{{ $json.error }}',
  'sync-bigin',
  NOW()
);
```

**Activar workflow**

---

### 🔨 PASO 5: Modificar Workflow Conversacional Existente

En tu workflow conversacional existente (el que recibe mensajes de CallBell):

**Agregar nodo al final:**

#### HTTP Request - Trigger Validación
- **Method:** POST
- **URL:** [URL del webhook de validación del Paso 3]
- **Body:**
```json
{
  "session_id": "{{ $json.session_id }}",
  "customer_name": "{{ $json.extracted_data.customer_name }}",
  "phone": "{{ $json.extracted_data.phone }}",
  "email": "{{ $json.extracted_data.email }}",
  "address": "{{ $json.extracted_data.address }}",
  "city": "{{ $json.extracted_data.city }}",
  "department": "{{ $json.extracted_data.department }}",
  "pack": "{{ $json.extracted_data.pack }}",
  "price": {{ $json.extracted_data.price }}
}
```

---

## 🧪 Testing - Probar Todo el Flujo

### Test 1: Datos de Prueba

```bash
curl -X POST http://localhost:5678/webhook/validate-order-data \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test-123",
    "customer_name": "juan perez",
    "phone": "+57 300 123 4567",
    "email": "Juan@Example.com",
    "address": "calle 123 barrio centro",
    "city": "bogota",
    "department": "cundinamarca",
    "pack": "Colchón King Size",
    "price": 50000
  }'
```

### Test 2: Verificar en PostgreSQL

```sql
-- Ver la orden creada
SELECT * FROM orders ORDER BY created_at DESC LIMIT 1;

-- Ver el log de acciones
SELECT * FROM actions_log ORDER BY created_at DESC LIMIT 5;

-- Ver si se sincronizó con Bigin
SELECT
  id,
  customer_name,
  synced_to_bigin,
  bigin_order_id,
  sync_error
FROM orders
WHERE id = (SELECT MAX(id) FROM orders);
```

### Test 3: Verificar en Bigin CRM

1. Ir a Bigin → Pipelines → Ventas Somnio
2. Buscar la orden creada
3. Verificar que todos los datos estén correctos

---

## 📊 Monitoreo y Mantenimiento

### Queries Útiles

**Ver órdenes pendientes de sincronizar:**
```sql
SELECT * FROM orders
WHERE synced_to_bigin = FALSE
ORDER BY created_at DESC;
```

**Ver errores de sincronización:**
```sql
SELECT
  id,
  customer_name,
  phone,
  sync_error,
  created_at
FROM orders
WHERE synced_to_bigin = FALSE
  AND sync_error IS NOT NULL;
```

**Estadísticas generales:**
```sql
SELECT
  COUNT(*) as total_orders,
  SUM(CASE WHEN synced_to_bigin THEN 1 ELSE 0 END) as synced,
  SUM(CASE WHEN NOT synced_to_bigin THEN 1 ELSE 0 END) as pending,
  SUM(price) as total_revenue
FROM orders;
```

**Log de acciones recientes:**
```sql
SELECT
  al.action_type,
  al.success,
  o.customer_name,
  al.created_at
FROM actions_log al
LEFT JOIN orders o ON al.order_id = o.id
ORDER BY al.created_at DESC
LIMIT 20;
```

---

## 🚨 Troubleshooting

### Problema: Orden no se sincroniza con Bigin

1. **Verificar Robot API:**
```bash
curl http://localhost:3000/health
```

2. **Ver logs del Robot API:**
```bash
tail -f /tmp/robot-api.log
```

3. **Verificar error específico:**
```sql
SELECT sync_error FROM orders WHERE id = [ORDER_ID];
```

### Problema: Workflow no se ejecuta

1. Verificar que el workflow esté **activado** (toggle en ON)
2. Ver ejecuciones en n8n → Executions
3. Ver logs de error en cada nodo

---

## ✨ Próximos Pasos / Mejoras Futuras

- [ ] Retry automático para órdenes fallidas
- [ ] Dashboard de monitoreo en tiempo real
- [ ] Notificaciones por Slack cuando hay errores
- [ ] Backup automático de datos
- [ ] Agregar más validaciones (email format, phone format)
- [ ] Integrar con más CRMs (cuando tengas tu propio CRM)

---

## 📞 Soporte

Si algo no funciona:
1. Ver logs de n8n
2. Ver logs de Robot API
3. Ver actions_log en PostgreSQL
4. Verificar que Bigin esté accesible

**Archivos importantes:**
- `/home/n8n-claude/proyectos/modelo-ia-distribuida/packages/robot-api`
- `/home/n8n-claude/proyectos/modelo-ia-distribuida/docs/`
- Base de datos: `carolina` en PostgreSQL
