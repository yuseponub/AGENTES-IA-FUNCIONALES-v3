# Workflow: Validación y Normalización de Datos

## 🎯 Propósito
Este workflow recibe datos extraídos por la IA y los valida/normaliza antes de guardarlos en la base de datos.

## 📥 Input (Trigger)
Webhook o llamada desde el workflow conversacional

**Datos de entrada:**
```json
{
  "session_id": "xxx",
  "customer_name": "juan perez",
  "phone": "+57 300 123 4567",
  "email": "Juan@Example.com",
  "address": "calle 123 barrio centro",
  "city": "bogota",
  "department": "cundinamarca",
  "pack": "Colchón King Size",
  "price": 50000
}
```

## 🔧 Nodos del Workflow

### 1. Webhook Trigger
- **Method:** POST
- **Path:** `/validate-order-data`

### 2. Set Node - Normalizar Datos
```javascript
// Normalizar nombre (Primera letra mayúscula)
const normalizeName = (name) => {
  return name.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Normalizar teléfono (sin + y espacios)
const normalizePhone = (phone) => {
  return phone.replace(/[\s+-]/g, '');
};

// Normalizar email (lowercase)
const normalizeEmail = (email) => {
  return email.toLowerCase().trim();
};

// Normalizar ciudad/departamento
const normalizeCity = (city) => {
  return city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
};

// Normalizar dirección
const normalizeAddress = (address) => {
  // Mayúscula en cada palabra importante
  return address
    .toLowerCase()
    .replace(/\b(calle|carrera|avenida|transversal|diagonal)\b/gi,
      match => match.charAt(0).toUpperCase() + match.slice(1));
};

return {
  session_id: $json.session_id,
  customer_name: normalizeName($json.customer_name || ''),
  phone: normalizePhone($json.phone || ''),
  email: normalizeEmail($json.email || ''),
  address: normalizeAddress($json.address || ''),
  city: normalizeCity($json.city || ''),
  department: normalizeCity($json.department || ''),
  pack: $json.pack,
  price: parseInt($json.price) || 0,
  status: 'pending',
  // Datos para Bigin
  bigin_data: {
    ordenName: `Orden ${normalizeName($json.customer_name || '')}`,
    subPipeline: 'Ventas Somnio Standard',
    stage: 'Nuevo Ingreso',
    closingDate: new Date().toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '/'),
    amount: parseInt($json.price) || 0,
    telefono: normalizePhone($json.phone || ''),
    direccion: normalizeAddress($json.address || ''),
    municipio: normalizeCity($json.city || ''),
    departamento: normalizeCity($json.department || ''),
    email: normalizeEmail($json.email || ''),
    description: 'WPP'
  }
};
```

### 3. IF Node - Validar Campos Requeridos
**Condiciones:**
- `customer_name` no está vacío
- `phone` no está vacío
- `address` no está vacío
- `city` no está vacío
- `price` > 0

**Si pasa validación:** Continuar al siguiente workflow
**Si falla validación:** Log error y notificar

## 📤 Output
```json
{
  "session_id": "xxx",
  "customer_name": "Juan Perez",
  "phone": "573001234567",
  "email": "juan@example.com",
  "address": "Calle 123 Barrio Centro",
  "city": "Bogotá",
  "department": "Cundinamarca",
  "pack": "Colchón King Size",
  "price": 50000,
  "status": "pending",
  "bigin_data": {
    "ordenName": "Orden Juan Perez",
    "subPipeline": "Ventas Somnio Standard",
    "stage": "Nuevo Ingreso",
    "closingDate": "31/12/2025",
    "amount": 50000,
    "telefono": "573001234567",
    "direccion": "Calle 123 Barrio Centro",
    "municipio": "Bogotá",
    "departamento": "Cundinamarca",
    "email": "juan@example.com",
    "description": "WPP"
  }
}
```

## ➡️ Siguiente
Triggerea el workflow de sincronización
