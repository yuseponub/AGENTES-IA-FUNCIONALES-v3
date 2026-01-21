# 04 - DATA EXTRACTOR

> **Rol:** Extractor de Datos Personales con IA
> **Endpoint:** `POST /webhook/data-extractor`
> **Archivo:** `workflows/04-data-extractor.json`
> **Modelo IA:** Claude Sonnet 4 (`claude-sonnet-4-20250514`)

---

## 1. DESCRIPCIÓN GENERAL

Data Extractor es el **agente especializado en captura de datos** del sistema v3DSL. Utiliza Claude AI para extraer información personal de los mensajes del usuario, normalizar datos colombianos (direcciones, ciudades, departamentos) y manejar negaciones explícitas.

### Responsabilidades Principales
- Recibir mensajes de usuarios con datos personales
- Extraer campos estructurados usando Claude AI
- Detectar negaciones ("no tengo correo")
- Normalizar datos al formato colombiano
- Mergear datos nuevos con existentes
- Retornar datos limpios y estructurados

---

## 2. ARQUITECTURA DE NODOS

### 2.1 Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            DATA EXTRACTOR                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────┐    ┌─────────────┐    ┌──────────────────┐    ┌────────────────┐  │
│  │ Webhook  │───▶│ Parse       │───▶│ Prepare Claude   │───▶│ Call Claude    │  │
│  │ POST     │    │ Input       │    │ Messages         │    │ API            │  │
│  └──────────┘    └─────────────┘    └──────────────────┘    └───────┬────────┘  │
│                                                                      │           │
│                                                                      ▼           │
│                                                              ┌─────────────┐     │
│                                                              │ Extract     │     │
│                                                              │ Response    │     │
│                                                              └──────┬──────┘     │
│                                                                     │            │
│                                                                     ▼            │
│                                                              ┌─────────────┐     │
│                                                              │ Detect      │     │
│                                                              │ Negations   │     │
│                                                              └──────┬──────┘     │
│                                                                     │            │
│                                                                     ▼            │
│                                                              ┌─────────────┐     │
│                                                              │ Clean       │     │
│                                                              │ Data        │     │
│                                                              └──────┬──────┘     │
│                                                                     │            │
│                                                                     ▼            │
│                                                              ┌─────────────┐     │
│                                                              │ Merge       │     │
│                                                              │ Data        │     │
│                                                              └──────┬──────┘     │
│                                                                     │            │
│                                                                     ▼            │
│                                                              ┌─────────────┐     │
│                                                              │ Respond     │     │
│                                                              │ JSON        │     │
│                                                              └─────────────┘     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Inventario Completo de Nodos

| # | Nodo | Tipo | Función |
|---|------|------|---------|
| 1 | **Webhook** | `webhook` | Recibe POST en `/data-extractor` |
| 2 | **Parse Input** | `code` | Extrae phone, last_message, captured_data |
| 3 | **Prepare Claude Messages** | `code` | Construye system prompt especializado en datos colombianos |
| 4 | **Call Claude API** | `httpRequest` | POST a `api.anthropic.com/v1/messages` |
| 5 | **Extract Response** | `code` | Parsea JSON, limpia markdown |
| 6 | **Detect Negations** | `code` | Identifica "no tengo X" y marca como "N/A" |
| 7 | **Clean Data** | `code` | Normaliza nombres, teléfonos, ciudades, departamentos |
| 8 | **Merge Data** | `code` | Combina datos nuevos con existentes |
| 9 | **Respond** | `respondToWebhook` | Retorna datos mergeados |

---

## 3. ENDPOINTS

### 3.1 Endpoint Principal

```
POST https://n8n.automatizacionesmorf.com/webhook/data-extractor
```

**Headers:**
```
Content-Type: application/json
```

**Payload de Entrada:**
```json
{
  "phone": "573001234567",
  "last_message": "Me llamo Juan Pérez, vivo en la calle 123 #45-67 barrio Centro en Bogotá, Cundinamarca. Mi celular es 3001234567 y no tengo correo",
  "captured_data": {
    "nombre": null,
    "apellido": null,
    "telefono": "573001234567",
    "direccion": null,
    "barrio": null,
    "ciudad": null,
    "departamento": null,
    "correo": null
  }
}
```

**Payload de Respuesta:**
```json
{
  "success": true,
  "extracted": {
    "nombre": "Juan",
    "apellido": "Pérez",
    "telefono": "573001234567",
    "direccion": "Calle 123 #45-67",
    "barrio": "Centro",
    "ciudad": "Bogotá",
    "departamento": "Cundinamarca",
    "correo": "N/A"
  },
  "merged": {
    "nombre": "Juan",
    "apellido": "Pérez",
    "telefono": "573001234567",
    "direccion": "Calle 123 #45-67",
    "barrio": "Centro",
    "ciudad": "Bogotá",
    "departamento": "Cundinamarca",
    "correo": "N/A"
  },
  "fields_updated": ["nombre", "apellido", "direccion", "barrio", "ciudad", "departamento", "correo"],
  "negations_detected": ["correo"]
}
```

---

## 4. LÓGICA DE NEGOCIO

### 4.1 Campos Extraídos

| Campo | Descripción | Normalización |
|-------|-------------|---------------|
| `nombre` | Primer nombre | Capitalización |
| `apellido` | Apellido(s) | Capitalización |
| `telefono` | Número celular | Formato 57XXXXXXXXXX |
| `direccion` | Dirección de entrega | Estandarización |
| `barrio` | Barrio/Localidad | Capitalización |
| `ciudad` | Ciudad | Nombre oficial |
| `departamento` | Departamento | Nombre oficial |
| `correo` | Email | Lowercase / N/A |

### 4.2 Detección de Negaciones

```javascript
const NEGATION_PATTERNS = {
  correo: [
    /no tengo correo/i,
    /no tengo email/i,
    /no uso correo/i,
    /sin correo/i,
    /no manejo correo/i
  ],
  barrio: [
    /no sé el barrio/i,
    /no conozco el barrio/i,
    /sin barrio/i
  ]
};

function detectNegations(message, existingData) {
  const negated = {};

  for (const [field, patterns] of Object.entries(NEGATION_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        negated[field] = 'N/A';
        break;
      }
    }
  }

  return negated;
}
```

### 4.3 Normalización de Nombres

```javascript
function normalizeName(name) {
  if (!name || name === 'N/A') return name;

  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
}

// Ejemplos:
// "juan perez" → "Juan Perez"
// "MARÍA JOSÉ" → "María José"
// "carlos andrés" → "Carlos Andrés"
```

### 4.4 Normalización de Teléfonos

```javascript
function normalizePhone(phone) {
  if (!phone || phone === 'N/A') return phone;

  // Remover todo excepto dígitos
  let clean = phone.replace(/\D/g, '');

  // Si tiene 10 dígitos y empieza con 3, agregar 57
  if (clean.length === 10 && clean.startsWith('3')) {
    clean = '57' + clean;
  }

  // Si tiene 12 dígitos y empieza con 57, está bien
  if (clean.length === 12 && clean.startsWith('57')) {
    return clean;
  }

  // Retornar original si no matchea patrón
  return phone;
}

// Ejemplos:
// "300 123 4567" → "573001234567"
// "3001234567" → "573001234567"
// "+57 300 123 4567" → "573001234567"
```

### 4.5 Normalización de Ciudades

```javascript
const CITY_MAPPINGS = {
  // Variaciones comunes → Nombre oficial
  'bogota': 'Bogotá',
  'medellin': 'Medellín',
  'cali': 'Cali',
  'barranquilla': 'Barranquilla',
  'cartagena': 'Cartagena',
  'bucaramanga': 'Bucaramanga',
  'pereira': 'Pereira',
  'santa marta': 'Santa Marta',
  'manizales': 'Manizales',
  'cucuta': 'Cúcuta',
  'ibague': 'Ibagué',
  'villavicencio': 'Villavicencio',
  'pasto': 'Pasto',
  'monteria': 'Montería',
  'neiva': 'Neiva',
  'soledad': 'Soledad',
  'valledupar': 'Valledupar',
  'soacha': 'Soacha',
  'bello': 'Bello',
  'floridablanca': 'Floridablanca'
};

function normalizeCity(city) {
  if (!city || city === 'N/A') return city;

  const normalized = city.toLowerCase().trim();
  return CITY_MAPPINGS[normalized] || normalizeName(city);
}
```

### 4.6 Normalización de Departamentos

```javascript
const DEPARTMENT_MAPPINGS = {
  'cundinamarca': 'Cundinamarca',
  'antioquia': 'Antioquia',
  'valle': 'Valle del Cauca',
  'valle del cauca': 'Valle del Cauca',
  'atlantico': 'Atlántico',
  'bolivar': 'Bolívar',
  'santander': 'Santander',
  'boyaca': 'Boyacá',
  'tolima': 'Tolima',
  'meta': 'Meta',
  'nariño': 'Nariño',
  'narino': 'Nariño',
  'cordoba': 'Córdoba',
  'huila': 'Huila',
  'cesar': 'Cesar',
  'caldas': 'Caldas',
  'risaralda': 'Risaralda',
  'norte de santander': 'Norte de Santander',
  'magdalena': 'Magdalena',
  'cauca': 'Cauca',
  'quindio': 'Quindío',
  'sucre': 'Sucre'
};

function normalizeDepartment(dept) {
  if (!dept || dept === 'N/A') return dept;

  const normalized = dept.toLowerCase().trim();
  return DEPARTMENT_MAPPINGS[normalized] || normalizeName(dept);
}
```

### 4.7 Normalización de Direcciones

```javascript
function normalizeAddress(address) {
  if (!address || address === 'N/A') return address;

  let normalized = address;

  // Estandarizar abreviaciones
  const replacements = {
    'cll': 'Calle',
    'cl': 'Calle',
    'cra': 'Carrera',
    'cr': 'Carrera',
    'kr': 'Carrera',
    'av': 'Avenida',
    'avda': 'Avenida',
    'diag': 'Diagonal',
    'dg': 'Diagonal',
    'trans': 'Transversal',
    'tv': 'Transversal',
    'apt': 'Apartamento',
    'apto': 'Apartamento',
    'int': 'Interior',
    'piso': 'Piso',
    'casa': 'Casa',
    'local': 'Local',
    'ofc': 'Oficina',
    'of': 'Oficina'
  };

  for (const [abbr, full] of Object.entries(replacements)) {
    const regex = new RegExp(`\\b${abbr}\\.?\\s*`, 'gi');
    normalized = normalized.replace(regex, full + ' ');
  }

  // Capitalizar primera letra de cada palabra
  normalized = normalized
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return normalized.trim();
}

// Ejemplos:
// "cll 123 # 45-67" → "Calle 123 # 45-67"
// "cra 7 no. 45-12 apt 301" → "Carrera 7 No. 45-12 Apartamento 301"
```

---

## 5. INTEGRACIÓN CON CLAUDE API

### 5.1 System Prompt Especializado

```javascript
const SYSTEM_PROMPT = `
Eres un extractor de datos especializado en información de envío para Colombia.

Tu ÚNICA tarea es extraer datos personales del mensaje del usuario.
NO analices la intención del mensaje, SOLO extrae datos.

## CAMPOS A EXTRAER

1. nombre: Primer nombre de la persona
2. apellido: Apellido(s) de la persona
3. telefono: Número de celular colombiano
4. direccion: Dirección completa de entrega
5. barrio: Barrio o localidad
6. ciudad: Ciudad de entrega
7. departamento: Departamento de Colombia
8. correo: Dirección de email

## REGLAS DE EXTRACCIÓN

### Nombres y Apellidos
- Separa nombre y apellido correctamente
- "Juan Carlos Pérez López" → nombre: "Juan Carlos", apellido: "Pérez López"
- Si solo hay un nombre: nombre: "Juan", apellido: null

### Teléfonos
- Extrae números de 10 dígitos que empiecen con 3
- "mi cel es 300 123 4567" → telefono: "3001234567"
- Ignora números fijos (empiezan con 6 o 7)

### Direcciones
- Incluye toda la información de ubicación
- "calle 123 #45-67 torre 2 apto 301" → direccion: "Calle 123 #45-67 Torre 2 Apartamento 301"

### Ciudades y Departamentos
- Usa nombres oficiales
- "bogota" → ciudad: "Bogotá"
- "medellin, antioquia" → ciudad: "Medellín", departamento: "Antioquia"

### Correos
- Extrae emails válidos
- Si dice "no tengo correo", NO extraigas nada

## RESPUESTA

Responde ÚNICAMENTE con JSON válido:
{
  "nombre": "valor" | null,
  "apellido": "valor" | null,
  "telefono": "valor" | null,
  "direccion": "valor" | null,
  "barrio": "valor" | null,
  "ciudad": "valor" | null,
  "departamento": "valor" | null,
  "correo": "valor" | null
}

Si no encuentras un campo, usa null.
`;
```

### 5.2 Configuración de Llamada

```javascript
const CLAUDE_CONFIG = {
  url: 'https://api.anthropic.com/v1/messages',
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  timeout: 30000
};

const requestBody = {
  model: CLAUDE_CONFIG.model,
  max_tokens: CLAUDE_CONFIG.max_tokens,
  system: SYSTEM_PROMPT,
  messages: [
    {
      role: 'user',
      content: `Extrae los datos personales de este mensaje:\n\n"${lastMessage}"`
    }
  ]
};
```

---

## 6. MERGE DE DATOS

### 6.1 Estrategia de Merge

```javascript
function mergeData(existing, extracted, negated) {
  const merged = { ...existing };
  const fieldsUpdated = [];

  // 1. Aplicar datos extraídos (solo si hay valor)
  for (const [field, value] of Object.entries(extracted)) {
    if (value && value !== null && value.trim() !== '') {
      if (merged[field] !== value) {
        merged[field] = value;
        fieldsUpdated.push(field);
      }
    }
  }

  // 2. Aplicar negaciones (marcar como N/A)
  for (const [field, value] of Object.entries(negated)) {
    if (!merged[field] || merged[field] === null) {
      merged[field] = value; // "N/A"
      fieldsUpdated.push(field);
    }
  }

  return { merged, fieldsUpdated };
}
```

### 6.2 Prioridad de Datos

1. **Datos nuevos extraídos** → Mayor prioridad
2. **Datos existentes válidos** → Se mantienen si no hay nuevos
3. **Negaciones detectadas** → Solo si campo está vacío

```javascript
// Ejemplo de prioridad:
const existing = { nombre: "Juan", ciudad: null };
const extracted = { nombre: "Carlos", ciudad: "Bogotá" };

// Resultado:
// { nombre: "Carlos", ciudad: "Bogotá" }
// Carlos sobrescribe Juan porque es dato nuevo
```

---

## 7. MANEJO DE ERRORES

### 7.1 Errores Esperados

| Error | Causa | Manejo |
|-------|-------|--------|
| Claude timeout | API lenta >30s | Retornar datos existentes sin cambios |
| Parse failed | JSON malformado | Retornar datos existentes |
| Empty message | Mensaje vacío | Skip extracción |

### 7.2 Fallback Response

```javascript
const FALLBACK_RESPONSE = {
  success: false,
  extracted: {},
  merged: capturedData, // Retornar datos existentes
  fields_updated: [],
  negations_detected: [],
  error: 'extraction_failed'
};
```

---

## 8. MÉTRICAS Y LOGGING

### 8.1 Eventos Logueados

| Evento | Datos |
|--------|-------|
| `extraction_started` | phone, message_length |
| `claude_request` | model, prompt_tokens |
| `claude_response` | latency_ms, response_tokens |
| `fields_extracted` | phone, fields_count, fields_list |
| `negations_detected` | phone, fields_negated |
| `data_merged` | phone, fields_updated |

---

## 9. CONSIDERACIONES PARA MORFX

### 9.1 Abstracción del Extractor

```typescript
interface DataExtractor {
  extract(message: string, context: ExtractionContext): Promise<ExtractionResult>;
}

interface ExtractionContext {
  existingData: Record<string, string | null>;
  locale: string;
  fieldDefinitions: FieldDefinition[];
}

interface ExtractionResult {
  extracted: Record<string, string | null>;
  negations: string[];
  confidence: Record<string, number>;
}

// Implementaciones por país/región
class ColombiaExtractor implements DataExtractor { ... }
class MexicoExtractor implements DataExtractor { ... }
class ArgentinaExtractor implements DataExtractor { ... }
```

### 9.2 Configuración de Campos por Tenant

```typescript
interface FieldDefinition {
  name: string;
  type: 'text' | 'phone' | 'email' | 'address';
  required: boolean;
  validationRules: ValidationRule[];
  normalizationFn: (value: string) => string;
  aliases: string[]; // Nombres alternativos en mensajes
}

interface TenantFieldConfig {
  tenantId: string;
  country: string;
  fields: FieldDefinition[];
  negationPatterns: Record<string, RegExp[]>;
}
```

### 9.3 Normalización Pluggable

```typescript
interface Normalizer {
  normalize(value: string, fieldType: string): string;
}

class CountryNormalizer implements Normalizer {
  constructor(private countryConfig: CountryConfig) {}

  normalize(value: string, fieldType: string): string {
    switch (fieldType) {
      case 'city':
        return this.countryConfig.cities[value.toLowerCase()] || value;
      case 'state':
        return this.countryConfig.states[value.toLowerCase()] || value;
      case 'phone':
        return this.normalizePhone(value);
      default:
        return value;
    }
  }
}
```

### 9.4 Validación de Datos

```typescript
interface DataValidator {
  validate(data: Record<string, string>, rules: ValidationRule[]): ValidationResult;
}

interface ValidationResult {
  valid: boolean;
  errors: Record<string, string[]>;
  warnings: Record<string, string[]>;
}

// Ejemplo de reglas
const COLOMBIA_VALIDATION_RULES: ValidationRule[] = [
  {
    field: 'telefono',
    rule: (v) => /^57[3][0-9]{9}$/.test(v),
    message: 'Teléfono debe ser celular colombiano válido'
  },
  {
    field: 'departamento',
    rule: (v) => VALID_DEPARTMENTS.includes(v),
    message: 'Departamento no válido'
  }
];
```
