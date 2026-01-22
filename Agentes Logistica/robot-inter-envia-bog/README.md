# Robot Interrapidisimo

Servidor Node.js que genera guias PDF para Interrapidisimo/Bogota y Excel para Envia.

## Funciones

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/health` | GET | Estado del servicio |
| `/api/generar-guia` | POST | Genera una guia PDF |
| `/api/generar-guias` | POST | Genera multiples guias en un PDF |
| `/api/generar-excel-envia` | POST | Genera Excel para Envia |
| `/api/download/:file` | GET | Descargar archivo generado |

## Instalacion

```bash
npm install
```

## Ejecucion

```bash
npm run dev
```

El servidor corre en `http://localhost:3002`

## Uso desde n8n

Desde n8n (Docker), usar la IP del host:
```
http://172.18.0.1:3002/api/generar-guias
http://172.18.0.1:3002/api/generar-excel-envia
```

## Ejemplo: Generar Guias Inter/Bogota

```json
POST /api/generar-guias
{
  "pedidos": [
    {
      "ciudad": "BOGOTA",
      "nombres": "JUAN",
      "apellidos": "PEREZ",
      "direccion": "Calle 123 #45-67",
      "barrio": "Centro",
      "celular": "3001234567",
      "totalConIva": 50000
    }
  ]
}
```

## Ejemplo: Generar Excel Envia

```json
POST /api/generar-excel-envia
{
  "ordenes": [
    {
      "Valor": 50000,
      "Nombre completo": "Juan Perez",
      "Telefono": "3001234567",
      "Direccion completa": "Calle 123 #45-67",
      "Municipio": "Bogota",
      "Departamento": "Cundinamarca"
    }
  ],
  "biginIds": ["12345"]
}
```

## Archivos Generados

Los archivos se guardan en `/opt/n8n/local-files/` y son servidos via Caddy en:
```
https://n8n.automatizacionesmorf.com/download/{filename}
```
