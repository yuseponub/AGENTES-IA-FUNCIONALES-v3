// Validar ciudades con el servidor
const pedidos = $input.all().map(item => item.json);

const response = await this.helpers.httpRequest({
  method: 'POST',
  url: 'http://172.17.0.1:3001/api/validar-pedidos',
  body: { pedidos },
  json: true
});

// Retornar pedidos con info de validación
return response.pedidos.map(pedido => {
  const { _index, ...datos } = pedido;
  return { json: datos };
});
