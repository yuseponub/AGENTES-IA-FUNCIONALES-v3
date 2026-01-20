# Workflow: Sincronización PostgreSQL + Bigin

## 🎯 Propósito
Guarda la orden en PostgreSQL, la sincroniza con Bigin CRM vía Robot API, y registra todas las acciones.

## 📥 Input
Datos validados y normalizados del workflow anterior

## 🔧 Nodos del Workflow

### 1. Webhook Trigger / Execute Workflow Trigger
- Recibe datos del workflow de validación

### 2. PostgreSQL Node - INSERT Order
**Operation:** Execute Query

```sql
INSERT INTO orders (
  session_id,
  customer_name,
  phone,
  email,
  address,
  city,
  department,
  pack,
  price,
  status,
  created_at
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
  '{{ $json.status }}',
  NOW()
) RETURNING id, *;
```

**Output:** Retorna el ID de la orden creada

### 3. Set Node - Preparar Datos para Bigin
```javascript
const orderData = $('PostgreSQL Node').first().json;

return {
  order_id: orderData.id,
  session_id: orderData.session_id,
  bigin_payload: {
    ordenName: `Orden #${orderData.id} - ${orderData.customer_name}`,
    contactName: orderData.customer_name,
    subPipeline: 'Ventas Somnio Standard',
    stage: 'Nuevo Ingreso',
    closingDate: new Date().toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }),
    amount: orderData.price,
    telefono: orderData.phone,
    direccion: orderData.address,
    municipio: orderData.city,
    departamento: orderData.department,
    email: orderData.email || '',
    description: 'WPP'
  }
};
```

### 4. HTTP Request Node - Robot API Create Order
**Method:** POST
**URL:** `http://localhost:3000/bigin/create-order`
**Headers:**
- Content-Type: application/json

**Body:**
```json
{{ $json.bigin_payload }}
```

**Options:**
- Response Format: JSON
- Timeout: 60000 (60 segundos)

### 5. IF Node - Verificar si Bigin Sync exitoso
**Condition:** `{{ $json.success }} === true`

#### 5a. TRUE Branch - Actualizar PostgreSQL con éxito

**PostgreSQL Node - UPDATE Order Success:**
```sql
UPDATE orders
SET
  synced_to_bigin = TRUE,
  bigin_order_id = '{{ $json.data.ordenName }}',
  last_sync_at = NOW()
WHERE id = {{ $('Set Node').first().json.order_id }};
```

**PostgreSQL Node - LOG Action Success:**
```sql
INSERT INTO actions_log (
  session_id,
  order_id,
  action_type,
  action_data,
  success,
  workflow_name,
  execution_id,
  created_at
) VALUES (
  '{{ $('Set Node').first().json.session_id }}',
  {{ $('Set Node').first().json.order_id }},
  'bigin_order_created',
  '{{ JSON.stringify($json) }}',
  TRUE,
  'sync-bigin',
  '{{ $execution.id }}',
  NOW()
);
```

#### 5b. FALSE Branch - Registrar error

**PostgreSQL Node - UPDATE Order Error:**
```sql
UPDATE orders
SET
  sync_error = '{{ $json.error || $json.message }}',
  last_sync_at = NOW()
WHERE id = {{ $('Set Node').first().json.order_id }};
```

**PostgreSQL Node - LOG Action Error:**
```sql
INSERT INTO actions_log (
  session_id,
  order_id,
  action_type,
  action_data,
  success,
  error_message,
  workflow_name,
  execution_id,
  created_at
) VALUES (
  '{{ $('Set Node').first().json.session_id }}',
  {{ $('Set Node').first().json.order_id }},
  'bigin_order_failed',
  '{{ JSON.stringify($json) }}',
  FALSE,
  '{{ $json.error || $json.message }}',
  'sync-bigin',
  '{{ $execution.id }}',
  NOW()
);
```

### 6. Merge Node
Une ambos branches (éxito y error)

### 7. Set Node - Preparar Respuesta Final
```javascript
const orderData = $('PostgreSQL Node').first().json;
const syncResult = $('IF Node').last().json;

return {
  success: syncResult.success || false,
  order_id: orderData.id,
  customer_name: orderData.customer_name,
  synced_to_bigin: orderData.synced_to_bigin || false,
  bigin_order_id: orderData.bigin_order_id || null,
  message: syncResult.success
    ? `Orden #${orderData.id} creada y sincronizada con Bigin`
    : `Orden #${orderData.id} creada pero falló sync con Bigin`
};
```

### 8. (Opcional) CallBell Node - Notificar Cliente
**Si sync exitoso:**
```
✅ Tu pedido ha sido registrado exitosamente!

📦 Orden: #{{order_id}}
💰 Total: ${{amount}}
📍 Dirección: {{address}}

Te contactaremos pronto para confirmar el envío.
```

## 📤 Output Final
```json
{
  "success": true,
  "order_id": 123,
  "customer_name": "Juan Perez",
  "synced_to_bigin": true,
  "bigin_order_id": "Orden #123 - Juan Perez",
  "message": "Orden #123 creada y sincronizada con Bigin"
}
```

## 🔄 Flujo Completo

```
1. INSERT en orders (PostgreSQL) ✅
   ↓
2. Preparar payload para Bigin
   ↓
3. POST a Robot API /bigin/create-order
   ↓
4. ¿Sync exitoso?
   ├─ SÍ → UPDATE orders (synced=true)
   │        INSERT actions_log (success=true)
   │        Notificar cliente ✅
   │
   └─ NO → UPDATE orders (sync_error)
           INSERT actions_log (success=false)
           Notificar error ⚠️
```

## 🎯 Ventajas de esta arquitectura

✅ **Siempre guardas en PostgreSQL** - Nunca pierdes datos
✅ **Retry automático** - Si Bigin falla, puedes reintentar después
✅ **Auditoría completa** - Todo queda registrado en actions_log
✅ **Separación de responsabilidades** - Cada paso es independiente
✅ **Fácil debugging** - Sabes exactamente dónde falló

## 📊 Queries Útiles

### Ver órdenes pendientes de sincronizar
```sql
SELECT * FROM orders
WHERE synced_to_bigin = FALSE
ORDER BY created_at DESC;
```

### Ver últimas acciones
```sql
SELECT
  al.*,
  o.customer_name,
  o.phone
FROM actions_log al
LEFT JOIN orders o ON al.order_id = o.id
ORDER BY al.created_at DESC
LIMIT 20;
```

### Ver órdenes con error de sync
```sql
SELECT
  id,
  customer_name,
  phone,
  sync_error,
  created_at
FROM orders
WHERE synced_to_bigin = FALSE
  AND sync_error IS NOT NULL
ORDER BY created_at DESC;
```
