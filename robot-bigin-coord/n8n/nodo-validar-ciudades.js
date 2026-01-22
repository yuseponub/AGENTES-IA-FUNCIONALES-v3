// Nodo Code: Validar Ciudades
// Este nodo va DESPUÉS de Claude y ANTES del Robot
// Llama al endpoint /api/validar-pedidos para:
// 1. Obtener el nombre exacto de la ciudad
// 2. Verificar si acepta recaudo contraentrega

const pedidos = $input.all().map(item => item.json);

// Llamar al endpoint de validación
const response = await fetch('http://172.17.0.1:3001/api/validar-pedidos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ pedidos }),
});

const resultado = await response.json();

// Separar válidos e inválidos
const validos = resultado.pedidos.filter(p => p._valido);
const invalidos = resultado.pedidos.filter(p => !p._valido);

// Retornar todos con marcador de validez
// Los inválidos se pueden filtrar después o enviar a Slack
return resultado.pedidos.map(pedido => {
  // Limpiar campos internos para el output
  const { _index, _valido, _error, _aceptaRecaudo, ...datosLimpios } = pedido;

  return {
    json: {
      ...datosLimpios,
      _valido,
      _error: _error || null,
      _aceptaRecaudo: _aceptaRecaudo || false,
    }
  };
});
