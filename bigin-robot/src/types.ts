/**
 * Types for Bigin Robot v2
 * Simplificado - sin manejo de sesiones
 */

// ============ CONFIG ============

export interface RobotConfig {
  headless: boolean;
  screenshotsEnabled: boolean;
  storagePath: string;
  slowMo?: number;
}

export interface BiginConfig {
  url: string;
  email: string;
  password: string;
  passphrase?: string;
}

// ============ API ============

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============ BIGIN ENTITIES ============

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string;
  phone?: string;
  company?: string;
  stage?: string;
  source?: string;
}

export interface CreateOrdenInput {
  ordenName: string;
  contactName?: string;
  subPipeline?: string;
  stage?: string;
  closingDate?: string;
  amount?: number;
  telefono?: string;
  direccion?: string;
  municipio?: string;
  departamento?: string;
  email?: string;
  description?: string;
  callBell?: string;
  transportadora?: string;
  guia?: string;
}

export interface CreateOrdenResult {
  orderId: string;
  orderUrl: string;
}

export interface FindLeadInput {
  phone?: string;
  email?: string;
  name?: string;
}

export interface CreateLeadInput {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  company?: string;
  source?: string;
}

export interface AddNoteInput {
  leadId: string;
  note: string;
}
