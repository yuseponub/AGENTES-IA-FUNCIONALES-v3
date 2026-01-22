# Robot Coordinadora - Analisis Profundo

Servidor Node.js que automatiza la creacion de pedidos en el portal web de Coordinadora usando Playwright (browser automation).

## Tabla de Contenidos

1. [Arquitectura General](#arquitectura-general)
2. [Plataforma Coordinadora](#plataforma-coordinadora)
3. [Mecanismo de Automatizacion](#mecanismo-de-automatizacion)
4. [Estructura del Codigo](#estructura-del-codigo)
5. [API Endpoints](#api-endpoints)
6. [Sistema de Ciudades](#sistema-de-ciudades)
7. [Flujo Completo](#flujo-completo)
8. [Configuracion](#configuracion)
9. [Patrones Reutilizables](#patrones-reutilizables)

---

## Arquitectura General

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│    n8n      │────>│  Robot API       │────>│  Coordinadora Web   │
│  (trigger)  │     │  (Express:3001)  │     │  (Playwright)       │
└─────────────┘     └──────────────────┘     └─────────────────────┘
                            │
                            v
                    ┌──────────────────┐
                    │  Chromium        │
                    │  (headless)      │
                    └──────────────────┘
```

**Componentes:**
- **n8n**: Orquestador que dispara el robot via HTTP
- **Express Server**: API REST que recibe pedidos
- **Playwright**: Automatiza el navegador Chrome
- **Coordinadora Web**: Portal ff.coordinadora.com

---

## Plataforma Coordinadora

### URLs del Portal

| URL | Descripcion |
|-----|-------------|
| `https://ff.coordinadora.com/` | Login |
| `https://ff.coordinadora.com/panel/pedidos` | Lista de pedidos |
| `https://ff.coordinadora.com/panel/agregar_pedidos/coordinadora` | Formulario nuevo pedido |

### Tecnologias del Portal

- **Frontend**: React con Material-UI (MUI)
- **DataGrid**: MUI DataGrid para listar pedidos
- **Autocomplete**: MUI Autocomplete para ciudades
- **Notificaciones**: SweetAlert2 para mensajes de exito/error
- **Autenticacion**: Sesion basada en cookies

### Formulario de Pedido - Campos

```
INFORMACION DESTINATARIO
├── identificacion_destinatario  (cedula/telefono)
├── nombres_destinatario
├── apellidos_destinatario
├── direccion_destinatario
├── ciudad_destinatario          (autocomplete MUI)
├── telefono_celular_destinatario
└── email_destinatario           (opcional)

INFORMACION PEDIDO
├── numero_pedido                (secuencial, ej: 9673)
├── referencia                   (ej: "AA1")
├── unidades                     (1, 2, 3)
├── total_iva                    (siempre 0)
├── total_coniva                 (77900, 109900, etc)
├── valor_declarado              (55000 fijo)
├── pago_contra_entrega          (S/N radio button)
└── flete_contra_entrega         (S/N radio button)

INFORMACION MEDIDAS
├── peso                         (0.08 kg default)
├── alto                         (5 cm default)
├── largo                        (5 cm default)
└── ancho                        (10 cm default)
```

### Selectores CSS Importantes

```typescript
// LOGIN
'input[name="usuario"]'
'input[name="clave"]'
'button:has-text("Ingresar")'

// LISTA PEDIDOS (MUI DataGrid)
'.MuiDataGrid-root'
'.MuiDataGrid-cell a'              // Links con numeros de pedido

// FORMULARIO
'input[name="identificacion_destinatario"]'
'input[name="nombres_destinatario"]'
'input[id^="mui-"]'                 // Autocomplete ciudad
'input[name="pago_contra_entrega"][value="S"]'
'input[name="pago_contra_entrega"][value="N"]'
'button[type="submit"]:has-text("Enviar Pedido")'

// NOTIFICACIONES (SweetAlert2)
'.swal-icon--success, .swal2-success'
'.swal-icon--error, .swal2-error'
'.swal-button, .swal2-confirm'
```

---

## Mecanismo de Automatizacion

### 1. Inicializacion del Browser

```typescript
// Chromium headless con configuracion especial
this.browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

this.context = await this.browser.newContext({
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
});
```

### 2. Manejo de Sesion (Cookies)

```typescript
// Guardar cookies despues de login
const cookies = await this.context.cookies();
fs.writeFileSync(cookiesPath, JSON.stringify(cookies));

// Cargar cookies al iniciar
const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
await this.context.addCookies(cookies);
```

**Archivo de cookies:** `storage/sessions/coordinadora-cookies.json`

### 3. Login Automatico

```typescript
// 1. Navegar al login
await this.page.goto('https://ff.coordinadora.com/', { waitUntil: 'networkidle' });

// 2. Verificar si ya esta logueado (redireccion a /panel)
if (this.page.url().includes('/panel')) {
  return true; // Sesion activa
}

// 3. Llenar credenciales
await this.page.fill('input[name="usuario"]', user);
await this.page.fill('input[name="clave"]', password);

// 4. Click en login
await this.page.click('button:has-text("Ingresar")');

// 5. Esperar y verificar
await this.page.waitForTimeout(5000);
if (this.page.url().includes('/panel')) {
  await this.saveCookies();
  return true;
}
```

### 4. Obtener Ultimo Numero de Pedido

```typescript
// Navegar a lista de pedidos
await this.page.goto('https://ff.coordinadora.com/panel/pedidos');

// Esperar MUI DataGrid
await this.page.waitForSelector('.MuiDataGrid-root');

// Buscar links con numeros de pedido
const links = await this.page.$$('.MuiDataGrid-cell a');

// Encontrar el numero mas alto
let maxNumber = 0;
for (const link of links) {
  const text = await link.textContent();
  const num = parseInt(text, 10);
  if (num > maxNumber && num > 1000) {
    maxNumber = num;
  }
}

return maxNumber; // ej: 9672
```

### 5. Autocomplete de Ciudad (MUI)

```typescript
// El campo de ciudad es un MUI Autocomplete
const ciudadInput = await this.page.$('input[id^="mui-"]');

// 1. Click para activar
await ciudadInput.click();

// 2. Escribir nombre de ciudad
await ciudadInput.fill('MEDELLIN');

// 3. Esperar opciones
await this.page.waitForTimeout(1000);

// 4. Seleccionar con teclado
await this.page.keyboard.press('ArrowDown');
await this.page.keyboard.press('Enter');
```

### 6. Manejo de Radio Buttons

```typescript
// Pago contra entrega: SI
await this.safeClick('input[name="pago_contra_entrega"][value="S"]');

// Verificar si esta deshabilitado (ciudad sin recaudo)
const element = await this.page.$('input[name="pago_contra_entrega"][value="S"]');
const isDisabled = await element.evaluate(el => el.disabled);
if (isDisabled) {
  throw new Error('Ciudad no permite recaudo');
}
```

### 7. Deteccion de Resultado (SweetAlert2)

```typescript
// Despues de enviar, buscar notificacion
const successIcon = await this.page.$('.swal-icon--success, .swal2-success');
const errorIcon = await this.page.$('.swal-icon--error, .swal2-error');

if (successIcon) {
  // Cerrar modal
  const confirmBtn = await this.page.$('.swal-button, .swal2-confirm');
  if (confirmBtn) await confirmBtn.click();
  return { success: true, numeroGuia: newNumber };
}

if (errorIcon) {
  const errorText = await this.page.$eval('.swal-text', el => el.textContent);
  return { success: false, error: errorText };
}
```

---

## Estructura del Codigo

```
robot-coordinadora/
├── src/
│   ├── api/
│   │   └── server.ts           # Express API (endpoints)
│   ├── adapters/
│   │   └── coordinadora-adapter.ts  # Automatizacion Playwright
│   ├── types/
│   │   └── index.ts            # Interfaces TypeScript
│   └── tools/                  # Scripts de testing
├── ciudades-coordinadora.txt   # 1488 ciudades totales
├── ciudades-SI-recaudo.txt     # 1181 ciudades con COD
├── storage/
│   └── sessions/
│       └── coordinadora-cookies.json
└── package.json
```

---

## API Endpoints

### GET /api/health
Estado del servicio.

### GET /api/ultimo-pedido
Obtiene el ultimo numero de pedido en Coordinadora.

### POST /api/validar-ciudad
Valida si una ciudad existe y acepta recaudo.

```json
{
  "municipio": "MEDELLIN",
  "departamento": "ANTIOQUIA",
  "esRecaudo": true
}
```

### POST /api/crear-pedido
Crea un pedido individual.

```json
{
  "identificacion": "3001234567",
  "nombres": "JUAN",
  "apellidos": "PEREZ GARCIA",
  "direccion": "Calle 123 #45-67",
  "ciudad": "MEDELLIN (ANT)",
  "departamento": "ANTIOQUIA",
  "celular": "3001234567",
  "referencia": "AA1",
  "unidades": 1,
  "totalConIva": 77900,
  "valorDeclarado": 55000,
  "esRecaudoContraentrega": true,
  "peso": 0.08,
  "alto": 5,
  "largo": 5,
  "ancho": 10,
  "biginOrderId": "123456789"
}
```

### POST /api/crear-pedidos-batch
Crea multiples pedidos en secuencia con pausa de 2 segundos entre cada uno.

```json
{
  "pedidos": [
    { ... pedido 1 ... },
    { ... pedido 2 ... }
  ]
}
```

---

## Sistema de Ciudades

### Archivos de Ciudades

1. **ciudades-coordinadora.txt** (1488 ciudades)
   - Todas las ciudades donde Coordinadora hace envios
   - Formato: `MUNICIPIO (ABREV_DEPTO)`
   - Ejemplo: `MEDELLIN (ANT)`, `BOGOTA (C/MARCA)`

2. **ciudades-SI-recaudo.txt** (1181 ciudades)
   - Ciudades que aceptan pago contra entrega (COD)
   - Mismo formato

### Mapeo de Departamentos

```typescript
const MAPEO_DEPARTAMENTOS = {
  'ANTIOQUIA': 'ANT',
  'CUNDINAMARCA': 'C/MARCA',
  'BOGOTA': 'C/MARCA',
  'VALLE DEL CAUCA': 'VALLE',
  'SANTANDER': 'STDER',
  // ... etc
};
```

### Validacion de Ciudad

```typescript
function buscarCiudadExacta(municipio, departamento) {
  // 1. Normalizar (quitar acentos, mayusculas)
  const municipioNorm = normalizar(municipio);
  const abrevDepto = MAPEO_DEPARTAMENTOS[departamento] || departamento;

  // 2. Buscar coincidencia exacta: "MUNICIPIO (ABREV)"
  const busqueda = `${municipioNorm} (${abrevDepto})`;
  const encontrada = ciudades.find(c => normalizar(c) === busqueda);

  return encontrada || null;
}
```

---

## Flujo Completo

```
1. n8n recibe comando "subir ordenes coord" en Slack
                    │
2. n8n obtiene ordenes de Bigin (Stage = ROBOT COORD)
                    │
3. n8n prepara datos y llama POST /api/crear-pedidos-batch
                    │
4. Robot valida ciudades y recaudo
                    │
5. Robot abre Chromium headless
                    │
6. Robot hace login (o usa cookies)
                    │
7. Para cada pedido:
   ├── Obtener ultimo numero de pedido
   ├── Navegar al formulario
   ├── Llenar todos los campos
   ├── Seleccionar ciudad (autocomplete)
   ├── Configurar recaudo (SI/NO)
   ├── Enviar pedido
   ├── Verificar SweetAlert (exito/error)
   └── Esperar 2 segundos
                    │
8. Robot cierra browser
                    │
9. Robot retorna resultados a n8n
                    │
10. n8n actualiza Bigin (Guia, Stage, Transportadora)
                    │
11. n8n envia mensaje a Slack
```

---

## Configuracion

### Variables de Entorno

```bash
COORDINADORA_URL=https://ff.coordinadora.com/
COORDINADORA_USER=tu_usuario
COORDINADORA_PASSWORD=tu_password
PORT=3001
```

### Dependencias Clave

```json
{
  "playwright": "^1.40.0",   // Automatizacion browser
  "express": "^4.18.2",      // API REST
  "dotenv": "^16.3.1"        // Variables de entorno
}
```

---

## Patrones Reutilizables

Estos patrones pueden usarse para crear robots similares para otras plataformas:

### 1. Patron: Manejo de Sesion con Cookies

```typescript
class WebAdapter {
  private cookiesPath = 'storage/cookies.json';

  async loadCookies() {
    if (fs.existsSync(this.cookiesPath)) {
      const cookies = JSON.parse(fs.readFileSync(this.cookiesPath, 'utf-8'));
      await this.context.addCookies(cookies);
    }
  }

  async saveCookies() {
    const cookies = await this.context.cookies();
    fs.writeFileSync(this.cookiesPath, JSON.stringify(cookies));
  }
}
```

### 2. Patron: Login con Verificacion de Redireccion

```typescript
async login(): Promise<boolean> {
  await this.page.goto(LOGIN_URL);

  // Ya logueado?
  if (this.page.url().includes('/dashboard')) return true;

  // Llenar form y submit
  await this.page.fill('#user', username);
  await this.page.fill('#pass', password);
  await this.page.click('#submit');

  // Verificar resultado
  await this.page.waitForTimeout(5000);
  return this.page.url().includes('/dashboard');
}
```

### 3. Patron: Autocomplete de MUI

```typescript
async fillAutocomplete(selector: string, value: string) {
  const input = await this.page.$(selector);
  await input.click();
  await input.fill(value);
  await this.page.waitForTimeout(1000);
  await this.page.keyboard.press('ArrowDown');
  await this.page.keyboard.press('Enter');
}
```

### 4. Patron: Deteccion de Resultado con SweetAlert

```typescript
async checkResult(): Promise<{ success: boolean; message: string }> {
  const success = await this.page.$('.swal2-success');
  const error = await this.page.$('.swal2-error');

  if (success) {
    const btn = await this.page.$('.swal2-confirm');
    if (btn) await btn.click();
    return { success: true, message: 'OK' };
  }

  if (error) {
    const text = await this.page.$eval('.swal2-content', el => el.textContent);
    return { success: false, message: text };
  }

  return { success: true, message: 'Sin notificacion' };
}
```

### 5. Patron: Safe Click (elementos deshabilitados)

```typescript
async safeClick(selector: string): Promise<boolean> {
  const element = await this.page.$(selector);
  if (!element) return false;

  const isDisabled = await element.evaluate(el => el.disabled);
  if (isDisabled) return false;

  await element.click();
  return true;
}
```

### 6. Patron: Reintentos con Fallback

```typescript
async getDataWithRetry(maxRetries = 3): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const data = await this.fetchData();
      if (data) return data;
    } catch (e) {
      if (attempt < maxRetries) {
        await this.page.waitForTimeout(2000);
      }
    }
  }
  return this.getFallbackData();
}
```

---

## Notas para Futuros Robots

1. **Headless en servidor**: Usar `headless: true` y `--no-sandbox`
2. **Timeouts generosos**: Esperar networkidle y agregar waitForTimeout
3. **Guardar screenshots en errores**: Facilita debugging
4. **Validar datos ANTES de automatizar**: Evita errores en el portal
5. **Cerrar browser siempre**: Usar try/finally para evitar fugas
6. **Batch con pausas**: 2+ segundos entre operaciones para no sobrecargar
7. **Cookies para sesion**: Evita login repetido, mas rapido
