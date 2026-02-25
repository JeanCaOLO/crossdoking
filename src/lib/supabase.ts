import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan las variables de entorno de Supabase');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    autoRefreshToken: true,
    storage: window.localStorage,
  },
});

export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'OPERADOR' | 'AUDITOR';

export interface User {
  id: string;
  auth_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Import {
  id: string;
  file_name: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'DONE';
  total_lines: number;
  completed_lines: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ImportLine {
  id: string;
  import_id: string;
  expedicion: string;
  pallet_code: string;
  ubicacion: string;
  sku: string;
  barcode: string;
  descripcion: string;
  cantidad_total: number;
  tienda: string;
  qty_to_send: number;
  qty_confirmed: number;
  status: 'PENDING' | 'PARTIAL' | 'DONE';
  camion: string;
  done_at?: string;
  done_by?: string;
  created_at: string;
}

export interface Pallet {
  id: string;
  pallet_code: string;
  ubicacion: string;
  status: 'OPEN' | 'DEPLETED' | 'BLOCKED';
  locked_by?: string;
  locked_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PalletInventory {
  id: string;
  pallet_id: string;
  sku: string;
  qty_initial: number;
  qty_available: number;
  updated_at: string;
}

export interface Container {
  id: string;
  code: string;
  import_id: string;
  tienda: string;
  status: 'OPEN' | 'CLOSED' | 'DISPATCHED';
  type?: 'NORMAL' | 'SOBRANTE';
  created_by: string;
  created_at: string;
  closed_at?: string;
  dispatched_at?: string;
}

export interface ContainerLine {
  id: string;
  container_id: string;
  pallet_id: string;
  sku: string;
  qty: number;
  source_import_line_id: string;
  created_at: string;
}

export interface ScanEvent {
  id: string;
  pallet_id?: string;
  event_type: 'SCAN_PALLET' | 'SCAN_SKU' | 'CONFIRM_QTY' | 'CLOSE' | 'UNLOCK' | 'ADJUST';
  raw_code?: string;
  sku?: string;
  tienda?: string;
  qty?: number;
  notes?: string;
  user_id: string;
  created_at: string;
}
