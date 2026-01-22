# Robot Coordinadora

Servidor Node.js que crea pedidos en la API de Coordinadora.

## Funciones

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/health` | GET | Estado del servicio |
| `/api/crear-pedido` | POST | Crea un pedido individual |
| `/api/crear-pedidos-batch` | POST | Crea multiples pedidos en lote |

## Instalacion

```bash
npm install
```

## Ejecucion

```bash
npm run dev
```

El servidor corre en `http://localhost:3001`

## Uso desde n8n

Desde n8n (Docker), usar la IP del host:
```
http://172.18.0.1:3001/api/crear-pedidos-batch
```

## Ejemplo: Crear Pedidos Batch

```json
POST /api/crear-pedidos-batch
{
  "pedidos": [
    {
      "biginOrderId": "123456789",
      "nombres": "JUAN",
      "apellidos": "PEREZ",
      "direccion": "Calle 123 #45-67",
      "ciudad": "MEDELLIN",
      "departamento": "ANTIOQUIA",
      "celular": "3001234567",
      "email": "juan@email.com",
      "valorRecaudo": 50000,
      "contenido": "Producto X",
      "unidades": 1,
      "peso": 1,
      "largo": 20,
      "ancho": 15,
      "alto": 10
    }
  ]
}
```

## Respuesta

```json
{
  "success": true,
  "total": 1,
  "exitosos": 1,
  "fallidos": 0,
  "resultados": [
    {
      "success": true,
      "biginOrderId": "123456789",
      "numeroPedido": "9876543210",
      "mensaje": "Pedido creado exitosamente"
    }
  ]
}
```

## Configuracion

Requiere credenciales de Coordinadora en variables de entorno o en el codigo:
- Usuario API
- Password API
- NIT
- Codigo remitente
