/**
 * Bigin Adapter Types
 */

export interface BiginConfig {
  url: string;
  email: string;
  password: string;
  otp?: string; // Optional OTP for 2FA
  passphrase?: string; // Optional OneAuth passphrase
}

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
  owner?: string;
  createdAt?: Date;
  [key: string]: any;
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

export interface UpdateFieldInput {
  leadId: string;
  field: string;
  value: any;
}

export interface UpdateStageInput {
  leadId: string;
  stage: string;
}

export interface CreateOrdenInput {
  ordenName: string;
  contactName?: string;
  subPipeline?: string;
  stage?: string;
  closingDate?: string; // DD/MM/YYYY
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
