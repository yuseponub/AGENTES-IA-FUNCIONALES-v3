# Robot Coordinadora - Analisis Profundo

Servidor Node.js que automatiza la creacion de pedidos en el portal web de Coordinadora usando Playwright (browser automation).

## Tabla de Contenidos

1. [IMPORTANTE: Operacion del Robot](#importante-operacion-del-robot)
2. [Arquitectura General](#arquitectura-general)
3. [Plataforma Coordinadora](#plataforma-coordinadora)
4. [Mecanismo de Automatizacion](#mecanismo-de-automatizacion)
5. [Estructura del Codigo](#estructura-del-codigo)
6. [API Endpoints](#api-endpoints)
7. [Sistema de Ciudades](#sistema-de-ciudades)
8. [Flujo Completo](#flujo-completo)
9. [Configuracion](#configuracion)
10. [Patrones Reutilizables](#patrones-reutilizables)

---

## IMPORTANTE: Operacion del Robot

### Servidor donde debe correr

```
SERVIDOR: VPS de produccion (mismo donde corre n8n)
IP: El mismo servidor donde esta n8n
RUTA: /root/proyectos/coordinadora-bot
PUERTO: 3001
```

**CRITICO**: El robot DEBE correr en el mismo servidor que n8n porque:
- n8n llama al robot via `http://172.18.0.1:3001` (IP del host Docker)
- Si el robot esta en otro servidor, n8n no podra comunicarse
- El robot necesita acceso a `/opt/n8n/local-files/` para archivos compartidos

### Iniciar el servidor

```bash
# Opcion 1: Desarrollo (con hot-reload)
cd /root/proyectos/coordinadora-bot
npm run api:dev

# Opcion 2: Produccion (background con nohup)
cd /root/proyectos/coordinadora-bot
nohup npx tsx src/api/server.ts > /tmp/coordinadora-api.log 2>&1 &

# Opcion 3: Produccion con PM2 (recomendado)
cd /root/proyectos/coordinadora-bot
npx pm2 start "npx tsx src/api/server.ts" --name coordinadora-bot --cwd /root/proyectos/coordinadora-bot
npx pm2 save
```

### Verificar que esta corriendo

```bash
# Ver si el puerto esta en uso
lsof -i :3001

# Health check
curl http://localhost:3001/api/health

# Ver logs (si uso nohup)
tail -f /tmp/coordinadora-api.log

# Ver logs (si uso pm2)
npx pm2 logs coordinadora-bot
```

### Detener el servidor

```bash
# Si uso nohup - encontrar y matar el proceso
lsof -i :3001 -t | xargs kill -9

# Si uso pm2
npx pm2 stop coordinadora-bot
npx pm2 delete coordinadora-bot
```

### Reiniciar el servidor

```bash
# Matar proceso actual y reiniciar
lsof -i :3001 -t | xargs kill -9 2>/dev/null
cd /root/proyectos/coordinadora-bot
nohup npx tsx src/api/server.ts > /tmp/coordinadora-api.log 2>&1 &

# O con pm2
npx pm2 restart coordinadora-bot
```

### Ciclo de vida del Browser (Playwright)

```
IMPORTANTE: El browser NO se mantiene abierto permanentemente.

Flujo por cada request:
1. Llega request POST /api/crear-pedido
2. Se ABRE un nuevo browser (Chromium headless)
3. Se cargan cookies guardadas (si existen)
4. Se hace login (o se verifica sesion activa)
5. Se ejecuta la operacion (crear pedido)
6. Se CIERRA el browser
7. Se retorna respuesta

Razon: Evitar fugas de memoria y problemas de sesion
```

### Manejo de Login y Sesion

```
El robot maneja la sesion automaticamente:

1. PRIMERA VEZ:
   - Abre browser
   - Va a ff.coordinadora.com
   - Detecta que no hay sesion
   - Llena usuario/password
   - Hace click en "Ingresar"
   - Guarda cookies en storage/sessions/coordinadora-cookies.json

2. SIGUIENTES VECES:
   - Abre browser
   - Carga cookies guardadas
   - Va a ff.coordinadora.com
   - Si redirige a /panel = sesion activa, continua
   - Si no redirige = hace login de nuevo

3. ARCHIVO DE COOKIES:
   Ruta: /root/proyectos/coordinadora-bot/storage/sessions/coordinadora-cookies.json

   Si hay problemas de sesion, borrar este archivo:
   rm /root/proyectos/coordinadora-bot/storage/sessions/coordinadora-cookies.json
```

### Credenciales

```bash
# Las credenciales estan en el codigo (coordinadora-adapter.ts)
# O pueden configurarse via variables de entorno:

export COORDINADORA_URL=https://ff.coordinadora.com/
export COORDINADORA_USER=tu_usuario
export COORDINADORA_PASSWORD=tu_password

# O crear archivo .env en /root/proyectos/coordinadora-bot/
```

### Troubleshooting Comun

| Problema | Solucion |
|----------|----------|
| "Connection refused" desde n8n | Verificar que robot este corriendo: `lsof -i :3001` |
| "Error en login" | Borrar cookies: `rm storage/sessions/coordinadora-cookies.json` |
| Browser no cierra | Matar procesos: `pkill -f chromium` |
| Puerto ocupado | Matar proceso: `lsof -i :3001 -t \| xargs kill -9` |
| Timeout en operacion | Verificar conexion a ff.coordinadora.com |

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

## GUIA: Crear un Nuevo Robot desde Cero

Esta guia explica paso a paso como crear un robot similar para otra plataforma web.

### Paso 1: Estructura de Carpetas

```bash
mkdir mi-nuevo-robot
cd mi-nuevo-robot

# Crear estructura
mkdir -p src/adapters src/api src/types src/tools storage/sessions

# Archivos principales
touch src/api/server.ts
touch src/adapters/plataforma-adapter.ts
touch src/types/index.ts
touch package.json
touch tsconfig.json
touch .env
```

Estructura final:
```
mi-nuevo-robot/
├── src/
│   ├── api/
│   │   └── server.ts           # Express API
│   ├── adapters/
│   │   └── plataforma-adapter.ts  # Automatizacion Playwright
│   ├── types/
│   │   └── index.ts            # Interfaces
│   └── tools/                  # Scripts de testing
├── storage/
│   └── sessions/               # Cookies guardadas
├── package.json
├── tsconfig.json
└── .env
```

### Paso 2: package.json Base

```json
{
  "name": "mi-nuevo-robot",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/api/server.ts",
    "start": "tsx src/api/server.ts",
    "test:login": "tsx src/tools/test-login.ts"
  },
  "dependencies": {
    "playwright": "^1.40.0",
    "express": "^4.18.2",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tsx": "^4.7.0",
    "@types/node": "^20.10.0",
    "@types/express": "^4.17.21"
  }
}
```

### Paso 3: Adapter Base (Boilerplate)

```typescript
// src/adapters/plataforma-adapter.ts
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════
// CONFIGURACION - MODIFICAR PARA CADA PLATAFORMA
// ═══════════════════════════════════════════════════════════

const URLS = {
  login: 'https://plataforma.com/login',
  dashboard: 'https://plataforma.com/dashboard',
  formulario: 'https://plataforma.com/nuevo',
};

const SELECTORS = {
  login: {
    userInput: 'input[name="email"]',
    passwordInput: 'input[name="password"]',
    submitButton: 'button[type="submit"]',
  },
  formulario: {
    // Agregar selectores del formulario
    campo1: 'input[name="campo1"]',
    campo2: 'input[name="campo2"]',
    submitButton: 'button[type="submit"]',
  },
  resultado: {
    successIcon: '.success, .swal2-success',
    errorIcon: '.error, .swal2-error',
    confirmButton: '.confirm, .swal2-confirm',
  },
};

// ═══════════════════════════════════════════════════════════
// CLASE ADAPTER
// ═══════════════════════════════════════════════════════════

export class PlataformaAdapter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isLoggedIn: boolean = false;

  private config: { url: string; user: string; password: string };
  private cookiesPath: string;

  constructor(config: { url: string; user: string; password: string }) {
    this.config = config;
    this.cookiesPath = path.join(process.cwd(), 'storage/sessions/cookies.json');
  }

  // ─────────────────────────────────────────────────────────
  // INICIALIZACION
  // ─────────────────────────────────────────────────────────

  async init(): Promise<void> {
    console.log('🚀 Iniciando browser...');

    this.browser = await chromium.launch({
      headless: true,  // true para servidor, false para debug
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });

    // Cargar cookies si existen
    await this.loadCookies();

    this.page = await this.context.newPage();
    console.log('✅ Browser iniciado');
  }

  // ─────────────────────────────────────────────────────────
  // MANEJO DE COOKIES
  // ─────────────────────────────────────────────────────────

  private async loadCookies(): Promise<void> {
    if (!this.context) return;

    try {
      if (fs.existsSync(this.cookiesPath)) {
        const cookies = JSON.parse(fs.readFileSync(this.cookiesPath, 'utf-8'));
        await this.context.addCookies(cookies);
        console.log('🍪 Cookies cargadas');
      }
    } catch (e) {
      console.log('⚠️ No se pudieron cargar cookies');
    }
  }

  private async saveCookies(): Promise<void> {
    if (!this.context) return;

    try {
      const cookies = await this.context.cookies();
      const dir = path.dirname(this.cookiesPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.cookiesPath, JSON.stringify(cookies, null, 2));
      console.log('🍪 Cookies guardadas');
    } catch (e) {
      console.log('⚠️ No se pudieron guardar cookies');
    }
  }

  // ─────────────────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────────────────

  async login(): Promise<boolean> {
    if (!this.page) await this.init();

    console.log('🔐 Iniciando login...');

    try {
      await this.page!.goto(URLS.login, { waitUntil: 'networkidle' });
      await this.page!.waitForTimeout(2000);

      // Verificar si ya estamos logueados (redireccion a dashboard)
      if (this.page!.url().includes('/dashboard') ||
          this.page!.url().includes('/panel')) {
        console.log('✅ Sesion ya activa');
        this.isLoggedIn = true;
        return true;
      }

      // Llenar credenciales
      console.log('📝 Llenando credenciales...');
      await this.page!.fill(SELECTORS.login.userInput, this.config.user);
      await this.page!.waitForTimeout(500);
      await this.page!.fill(SELECTORS.login.passwordInput, this.config.password);
      await this.page!.waitForTimeout(500);

      // Click en login
      console.log('🖱️ Haciendo click en login...');
      await this.page!.click(SELECTORS.login.submitButton);
      await this.page!.waitForTimeout(5000);

      // Verificar login exitoso
      if (this.page!.url().includes('/dashboard') ||
          this.page!.url().includes('/panel')) {
        console.log('✅ Login exitoso');
        await this.saveCookies();
        this.isLoggedIn = true;
        return true;
      }

      console.log('❌ Login falló');
      return false;

    } catch (error) {
      console.error('❌ Error en login:', error);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────
  // OPERACION PRINCIPAL (PERSONALIZAR)
  // ─────────────────────────────────────────────────────────

  async ejecutarOperacion(datos: any): Promise<{ success: boolean; resultado?: any; error?: string }> {
    if (!this.isLoggedIn) {
      const loginOk = await this.login();
      if (!loginOk) {
        return { success: false, error: 'Error en login' };
      }
    }

    console.log('📦 Ejecutando operacion...');

    try {
      // 1. Navegar al formulario
      await this.page!.goto(URLS.formulario, { waitUntil: 'networkidle' });
      await this.page!.waitForTimeout(3000);

      // 2. Llenar campos (PERSONALIZAR SEGUN FORMULARIO)
      await this.fillInput(SELECTORS.formulario.campo1, datos.campo1);
      await this.fillInput(SELECTORS.formulario.campo2, datos.campo2);

      // 3. Enviar formulario
      console.log('📤 Enviando...');
      await this.page!.click(SELECTORS.formulario.submitButton);
      await this.page!.waitForTimeout(5000);

      // 4. Verificar resultado
      const result = await this.checkResult();
      return result;

    } catch (error) {
      console.error('❌ Error:', error);

      // Guardar screenshot de error
      const errorPath = path.join(process.cwd(), 'storage/artifacts', `error-${Date.now()}.png`);
      await this.page!.screenshot({ path: errorPath });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  // ─────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────

  private async fillInput(selector: string, value: string): Promise<void> {
    try {
      const field = await this.page!.$(selector);
      if (field) {
        await field.fill(value);
        console.log(`   ✓ ${selector}: ${value.substring(0, 30)}...`);
      }
    } catch (e) {
      console.log(`   ⚠️ Error en ${selector}`);
    }
  }

  private async safeClick(selector: string): Promise<boolean> {
    try {
      const element = await this.page!.$(selector);
      if (!element) return false;

      const isDisabled = await element.evaluate(el => (el as any).disabled);
      if (isDisabled) {
        console.log(`   ⏭️ Elemento deshabilitado: ${selector}`);
        return false;
      }

      await element.click();
      return true;
    } catch (e) {
      return false;
    }
  }

  private async checkResult(): Promise<{ success: boolean; resultado?: any; error?: string }> {
    const successIcon = await this.page!.$(SELECTORS.resultado.successIcon);
    const errorIcon = await this.page!.$(SELECTORS.resultado.errorIcon);

    if (successIcon) {
      console.log('✅ Operacion exitosa');

      // Cerrar modal si hay boton
      const confirmBtn = await this.page!.$(SELECTORS.resultado.confirmButton);
      if (confirmBtn) await confirmBtn.click();

      return { success: true };
    }

    if (errorIcon) {
      const errorText = await this.page!.$eval('.swal-text, .swal2-content, .error-message',
        el => el.textContent).catch(() => 'Error desconocido');
      return { success: false, error: errorText || 'Error desconocido' };
    }

    // Sin notificacion, asumir exito
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────
  // CIERRE
  // ─────────────────────────────────────────────────────────

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      this.isLoggedIn = false;
      console.log('🔒 Browser cerrado');
    }
  }
}
```

### Paso 4: Server API Base (Boilerplate)

```typescript
// src/api/server.ts
import 'dotenv/config';
import express from 'express';
import { PlataformaAdapter } from '../adapters/plataforma-adapter.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ═══════════════════════════════════════════════════════════
// HELPER: Crear adapter nuevo para cada request
// ═══════════════════════════════════════════════════════════

async function createAdapter(): Promise<PlataformaAdapter> {
  const adapter = new PlataformaAdapter({
    url: process.env.PLATAFORMA_URL || '',
    user: process.env.PLATAFORMA_USER || '',
    password: process.env.PLATAFORMA_PASSWORD || '',
  });

  await adapter.init();

  const loginOk = await adapter.login();
  if (!loginOk) {
    await adapter.close();
    throw new Error('Error en login');
  }

  return adapter;
}

// ═══════════════════════════════════════════════════════════
// ENDPOINTS
// ═══════════════════════════════════════════════════════════

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'mi-nuevo-robot' });
});

// Operacion individual
app.post('/api/ejecutar', async (req, res) => {
  console.log('\n' + '═'.repeat(60));
  console.log('📦 POST /api/ejecutar');

  let adapter: PlataformaAdapter | null = null;

  try {
    adapter = await createAdapter();
    const result = await adapter.ejecutarOperacion(req.body);
    res.json(result);

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  } finally {
    // SIEMPRE cerrar el browser
    if (adapter) {
      console.log('🔒 Cerrando browser...');
      await adapter.close();
    }
  }
});

// Operacion batch (multiples)
app.post('/api/ejecutar-batch', async (req, res) => {
  const items = req.body.items || [];

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Se requiere array de items' });
  }

  console.log(`📋 Procesando ${items.length} items...`);
  const resultados: any[] = [];

  for (let i = 0; i < items.length; i++) {
    console.log(`\n[${i + 1}/${items.length}]`);

    let adapter: PlataformaAdapter | null = null;

    try {
      adapter = await createAdapter();
      const result = await adapter.ejecutarOperacion(items[i]);
      resultados.push({ ...result, index: i });
    } catch (error) {
      resultados.push({
        success: false,
        error: error instanceof Error ? error.message : 'Error',
        index: i,
      });
    } finally {
      if (adapter) await adapter.close();
    }

    // Pausa entre operaciones
    if (i < items.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  const exitosos = resultados.filter(r => r.success).length;
  res.json({
    success: exitosos === items.length,
    total: items.length,
    exitosos,
    fallidos: items.length - exitosos,
    resultados,
  });
});

// ═══════════════════════════════════════════════════════════
// INICIAR SERVIDOR
// ═══════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`
═══════════════════════════════════════════════════
🚀 MI NUEVO ROBOT API
═══════════════════════════════════════════════════
📍 URL: http://localhost:${PORT}

📋 Endpoints:
   GET  /api/health    - Estado
   POST /api/ejecutar  - Operacion individual
   POST /api/ejecutar-batch - Multiples operaciones

⏳ Esperando requests...
═══════════════════════════════════════════════════
  `);
});
```

### Paso 5: Checklist de Implementacion

```
□ FASE 1: ANALISIS DE LA PLATAFORMA
  □ Identificar URL de login
  □ Identificar URL del formulario/operacion
  □ Identificar selectores CSS de campos
  □ Identificar como detectar exito/error
  □ Verificar si usa cookies para sesion
  □ Documentar tecnologias (React, MUI, etc)

□ FASE 2: IMPLEMENTAR ADAPTER
  □ Crear estructura de carpetas
  □ Configurar URLS y SELECTORS
  □ Implementar init() con Playwright
  □ Implementar login() con verificacion
  □ Implementar operacion principal
  □ Implementar close()
  □ Probar login manualmente (headless: false)

□ FASE 3: IMPLEMENTAR API
  □ Crear server.ts con Express
  □ Implementar endpoint health
  □ Implementar endpoint operacion individual
  □ Implementar endpoint batch (si aplica)
  □ Asegurar try/finally para cerrar browser

□ FASE 4: TESTING
  □ Probar health check
  □ Probar operacion individual
  □ Probar batch con multiples items
  □ Probar manejo de errores
  □ Verificar que cookies se guardan/cargan

□ FASE 5: INTEGRACION CON N8N
  □ Probar llamada desde n8n
  □ Usar IP 172.18.0.1 (no localhost)
  □ Verificar formato de respuesta
  □ Crear nodos de formateo Slack
```

### Paso 6: Errores Comunes y Soluciones

| Error | Causa | Solucion |
|-------|-------|----------|
| `net::ERR_CONNECTION_REFUSED` | Browser no puede conectar | Verificar URL de la plataforma |
| `Timeout waiting for selector` | Selector incorrecto o pagina no cargo | Aumentar timeout, verificar selector |
| `Element is not clickable` | Elemento oculto o superpuesto | Usar `{ force: true }` o scroll |
| `Session expired` | Cookies vencidas | Borrar cookies, hacer login de nuevo |
| `Browser already closed` | Cerrado antes de tiempo | Verificar flujo async/await |
| `Memory leak` | Browser no se cierra | Agregar try/finally con close() |
| `EADDRINUSE` | Puerto ocupado | Matar proceso: `lsof -i :PORT -t \| xargs kill` |

### Paso 7: Tips de Debugging

```typescript
// 1. Modo visible (no headless) para ver que hace
this.browser = await chromium.launch({
  headless: false,  // <- cambiar a false
  slowMo: 1000,     // <- agregar delay entre acciones
});

// 2. Guardar screenshot en cada paso
await this.page.screenshot({ path: `step-${stepNumber}.png` });

// 3. Imprimir HTML de un elemento
const html = await this.page.$eval('selector', el => el.outerHTML);
console.log(html);

// 4. Esperar a que aparezca elemento
await this.page.waitForSelector('selector', { timeout: 30000 });

// 5. Imprimir URL actual
console.log('URL actual:', this.page.url());

// 6. Listar todos los inputs
const inputs = await this.page.$$eval('input', els =>
  els.map(el => ({ name: el.name, id: el.id, type: el.type }))
);
console.log('Inputs:', inputs);
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
8. **Un browser por request**: Evita problemas de concurrencia y memoria
9. **Logs detallados**: Facilita debugging en produccion
10. **Mismo servidor que n8n**: Usar IP 172.18.0.1 para comunicacion
