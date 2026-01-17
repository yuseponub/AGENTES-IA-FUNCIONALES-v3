# Data Extractor Simple - Documentación Técnica

## 📋 Resumen
**Workflow:** Data Extractor Simple - DSL
**Función Principal:** Extractor de datos personales usando Claude API
**Tipo:** Extractor LLM + Limpiador de datos
**Endpoints:** `/webhook/data-extractor`

## 🎯 Propósito

El Data Extractor usa Claude para extraer datos personales del mensaje del usuario (nombre, apellido, teléfono, dirección, etc.), los limpia, normaliza y retorna listos para guardar en el state.

## 🔄 Flujo de Procesamiento

### 1. Recepción
```
Webhook → Parse Input
```

**Input esperado:**
```json
{
  "phone": "57...",
  "last_message": "Juan Perez, calle 123, Bogotá",
  "captured_data": {
    "nombre": "Juan"
  }
}
```

### 2. Preparación para Claude
```
Parse Input → Prepare Claude Messages
```

**System Prompt:**
```
Eres un extractor de datos especializado. Tu ÚNICA tarea es extraer información personal del mensaje del usuario.

IGNORA completamente el intent del mensaje. SOLO extrae datos.

Analiza el mensaje y retorna JSON:
{
  "extracted_data": {
    "nombre": "...",
    "apellido": "...",
    "telefono": "...",
    "direccion": "...",
    "barrio": "...",
    "ciudad": "...",
    "departamento": "...",
    "correo": "..."
  }
}

**Reglas:**
1. Extrae CUALQUIER campo que encuentres
2. NO inventes datos
3. Si no encuentras nada, retorna campos vacíos
4. Si el usuario dice "es el mismo" o "el mismo", usa el telefono como referencia
5. Formatos aceptados:
   - Nombres: "Jose", "Jose Romero" → nombre: Jose, apellido: Romero
   - Teléfonos: "3137549286", "313 754 9286", "+57 313 754 9286"
   - Dirección completa: "Calle 123 #45-67, Barrio Centro, Bogotá, Cundinamarca"
   - Separada: "Calle 123 #45-67" (dirección), "Centro" (barrio), etc.

Retorna SOLO el JSON, sin markdown ni texto adicional.
```

### 3. Llamada a Claude API
```
Prepare Messages → Call Claude API
```

**Configuración:**
- Model: `claude-sonnet-4-20250514`
- Max tokens: 1024
- Timeout: 30 segundos

### 4. Extracción de Respuesta
```
Call Claude API → Extract Response
```

**Parse JSON:**
```javascript
let cleanText = responseText.trim();
if (cleanText.startsWith('```json')) {
  cleanText = cleanText.replace(/^```json\\s*/, '').replace(/\\s*```$/, '');
}

const parsed = JSON.parse(cleanText);
const extracted = parsed.extracted_data || {};
```

### 5. Detección de Negaciones
```
Extract Response → Detect Negations
```

**Patrones de negación:**
```javascript
const negationPatterns = {
  'correo': ['no tengo correo', 'no cuento con correo', 'sin correo',
             'no correo', 'no tengo email', 'no email'],
  'barrio': ['no tengo barrio', 'no se el barrio', 'sin barrio', 'no barrio']
};
```

**Lógica:**
```javascript
Object.keys(negationPatterns).forEach(field => {
  const patterns = negationPatterns[field];
  const hasNegation = patterns.some(pattern => userText.includes(pattern));

  if (hasNegation) {
    console.log(`✅ Detected negation for field: ${field}`);
    negatedFields[field] = 'N/A';
  }
});
```

**Razón:** Si el usuario dice "no tengo correo", guardamos `correo: "N/A"` para no volver a preguntar.

### 6. Limpieza de Datos
```
Detect Negations → Clean Data
```

**Helper functions:**

#### capitalize()
```javascript
function capitalize(str) {
  return str.trim().toLowerCase().split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
// "juan perez" → "Juan Perez"
```

#### normalizePhone()
```javascript
function normalizePhone(phone) {
  let cleaned = phone.replace(/\\D/g, '');  // Solo números
  if (cleaned.startsWith('57') && cleaned.length > 10) {
    cleaned = cleaned.substring(2);  // Quitar 57 si ya tiene 10 dígitos
  }
  if (cleaned.length === 10) {
    return '57' + cleaned;  // Agregar 57
  }
  return phone;
}
// "313 754 9286" → "573137549286"
```

**Mapas de normalización:**
```javascript
const departamentosMap = {
  'antioquia': 'Antioquia',
  'bogota': 'Bogotá D.C.',
  'bogota d.c.': 'Bogotá D.C.',
  'cundinamarca': 'Cundinamarca',
  'valle del cauca': 'Valle del Cauca',
  'valle': 'Valle del Cauca',
  // etc...
};

const ciudadesMap = {
  'bogota': 'Bogotá',
  'medellin': 'Medellín',
  'cali': 'Cali',
  'barranquilla': 'Barranquilla',
  // etc...
};
```

**Aplicación:**
```javascript
const cleanedData = {};

if (extracted.nombre) cleanedData.nombre = capitalize(extracted.nombre);
if (extracted.apellido) cleanedData.apellido = capitalize(extracted.apellido);
if (extracted.telefono) cleanedData.telefono = normalizePhone(extracted.telefono);
if (extracted.direccion) cleanedData.direccion = capitalize(extracted.direccion);
if (extracted.barrio) cleanedData.barrio = extracted.barrio === 'N/A' ? 'N/A' : capitalize(extracted.barrio);

if (extracted.ciudad) {
  const lower = extracted.ciudad.toLowerCase().trim();
  cleanedData.ciudad = ciudadesMap[lower] || capitalize(extracted.ciudad);
}

if (extracted.departamento) {
  const lower = extracted.departamento.toLowerCase().trim();
  cleanedData.departamento = departamentosMap[lower] || capitalize(extracted.departamento);
}

if (extracted.correo) cleanedData.correo = extracted.correo === 'N/A' ? 'N/A' : extracted.correo.toLowerCase().trim();
```

### 7. Merge con Datos Existentes
```
Clean Data → Merge Data
```

**Lógica de merge:**
```javascript
const mergedData = { ...existingData };

Object.keys(newData).forEach(key => {
  if (newData[key] && String(newData[key]).trim() !== '') {
    mergedData[key] = newData[key];  // Nuevos datos tienen prioridad
  }
});
```

**Campos completos:**
```javascript
const requiredFields = ['nombre', 'apellido', 'telefono', 'direccion',
                        'barrio', 'departamento', 'ciudad', 'correo'];
const filledFields = requiredFields.filter(f =>
  mergedData[f] && String(mergedData[f]).trim() !== ''
).length;

const allComplete = filledFields === requiredFields.length;
```

### 8. Respuesta
```
Merge Data → Respond
```

**Response:**
```json
{
  "phone": "57...",
  "extracted_data": {
    "nombre": "Juan",
    "apellido": "Perez"
  },
  "captured_data": {
    "nombre": "Juan",
    "apellido": "Perez",
    "telefono": "573137549286",
    "direccion": "Calle 123 #45-67",
    "ciudad": "Bogotá",
    "departamento": "Cundinamarca",
    "barrio": "Centro",
    "correo": "juan@email.com"
  },
  "fields_complete": 8,
  "all_fields_complete": true
}
```

## 📊 Campos Extraídos

### Campos Personales
- `nombre` - Primer nombre
- `apellido` - Apellido(s)
- `telefono` - Teléfono (normalizado con 57)
- `correo` - Email

### Campos de Dirección
- `direccion` - Dirección completa
- `barrio` - Barrio o localidad
- `ciudad` - Ciudad o municipio (normalizada)
- `departamento` - Departamento (normalizado)

## 🎯 Casos de Uso

### Caso 1: Nombre Completo
```
Input: "Juan Perez"
Claude extrae: {nombre: "Juan", apellido: "Perez"}
Clean: {nombre: "Juan", apellido: "Perez"}
```

### Caso 2: Dirección Completa
```
Input: "calle 123 #45-67, barrio centro, bogota, cundinamarca"
Claude extrae: {
  direccion: "calle 123 #45-67",
  barrio: "centro",
  ciudad: "bogota",
  departamento: "cundinamarca"
}
Clean: {
  direccion: "Calle 123 #45-67",
  barrio: "Centro",
  ciudad: "Bogotá",
  departamento: "Cundinamarca"
}
```

### Caso 3: Teléfono con Espacios
```
Input: "mi teléfono es 313 754 9286"
Claude extrae: {telefono: "313 754 9286"}
Clean: {telefono: "573137549286"}
```

### Caso 4: Negación de Campo
```
Input: "no tengo correo"
Detect Negations: {correo: "N/A"}
Output: {correo: "N/A"}
```

### Caso 5: Ciudad con Variaciones
```
Input: "vivo en bogota"
Claude extrae: {ciudad: "bogota"}
Clean: {ciudad: "Bogotá"}  // Normalizado con ciudadesMap
```

## 🧹 Normalización de Datos

### Departamentos Normalizados
- `bogota` → `Bogotá D.C.`
- `antioquia` → `Antioquia`
- `valle` → `Valle del Cauca`
- `valle del cauca` → `Valle del Cauca`
- etc.

### Ciudades Normalizadas
- `bogota` → `Bogotá`
- `medellin` → `Medellín`
- `cali` → `Cali`
- etc.

### Teléfonos
- Quita caracteres no numéricos
- Agrega prefijo `57` si faltan
- Quita `57` duplicado si ya tiene 10 dígitos

### Capitalización
- Primera letra mayúscula por palabra
- Resto minúsculas
- "JUAN PEREZ" → "Juan Perez"

## ⚙️ Configuración

### Claude API
- **Model:** `claude-sonnet-4-20250514`
- **Max Tokens:** 1024
- **Timeout:** 30 segundos

### Credenciales n8n
- **Anthropic API:** `anthropic-api-account`

## 📈 Métricas y Logs

### Console Logs
- `📥 DATA EXTRACTOR INPUT` - Input recibido
- `🤖 CLAUDE EXTRACTED` - Datos extraídos por Claude
- `🔍 DETECTING NEGATIONS` - Detección de negaciones
- `✅ Detected negation for field: X` - Negación detectada
- `🧹 CLEANING DATA` - Limpieza de datos
- `✨ CLEANED DATA` - Datos limpios
- `📊 MERGE RESULT` - Resultado del merge

## 🚨 Errores Comunes

### Error: "No extrajo nada"
**Causa:** Mensaje no contiene datos personales
**Solución:** Retorna campos vacíos

### Error: "Ciudad mal normalizada"
**Causa:** Ciudad no está en ciudadesMap
**Solución:** Usa capitalize() como fallback

### Error: "Teléfono mal formateado"
**Causa:** Formato no reconocido
**Solución:** Retorna como está, normalizePhone() hace lo posible

## 🔗 Dependencias

**Data Extractor depende de:**
- Claude API (Anthropic)
- Historial v3 (llamado por)

**Workflows que dependen de Data Extractor:**
- Historial v3 (llama en modo collecting_data)

## 📝 Notas Importantes

1. **Solo extrae, no analiza intent:** Diferente de State Analyzer
2. **Merge no destructivo:** Datos nuevos no borran antiguos
3. **Negaciones inteligentes:** "no tengo X" → guarda "N/A"
4. **Normalización de ciudades/departamentos:** Usa mapas
5. **Capitalización automática:** Nombres propios
6. **Teléfonos con prefijo:** Siempre 57XXXXXXXXXX
7. **Email lowercase:** Para consistencia
