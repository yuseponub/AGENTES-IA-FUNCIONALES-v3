// Configuración de Coordinadora
export interface CoordinadoraConfig {
  url: string;
  user: string;
  password: string;
}

// Configuración de Bigin
export interface BiginConfig {
  url: string;
  email: string;
  password: string;
  passphrase?: string;
}

// Datos de una orden de Bigin
export interface BiginOrder {
  orderId: string;
  orderName: string;
  contactName?: string;
  telefono: string;
  direccion: string;
  municipio: string;
  departamento: string;
  email?: string;
  description?: string;
  amount?: number;
  stage: string;
}

// Datos para crear guía en Coordinadora
export interface CreateGuiaInput {
  // Destinatario
  nombreDestinatario: string;
  telefonoDestinatario: string;
  direccionDestinatario: string;
  ciudadDestino: string;
  departamentoDestino: string;

  // Remitente (puede ser fijo)
  nombreRemitente?: string;
  telefonoRemitente?: string;
  direccionRemitente?: string;
  ciudadOrigen?: string;

  // Paquete
  peso?: number;
  alto?: number;
  ancho?: number;
  largo?: number;
  valorDeclarado?: number;
  contenido?: string;

  // Referencias
  referencia1?: string; // Order ID de Bigin
  referencia2?: string;
  observaciones?: string;
}

// Resultado de crear guía
export interface GuiaResult {
  success: boolean;
  numeroGuia?: string;
  error?: string;
}

// Resultado del proceso completo
export interface SyncResult {
  biginOrderId: string;
  numeroGuia?: string;
  newStage?: string;
  success: boolean;
  error?: string;
}
