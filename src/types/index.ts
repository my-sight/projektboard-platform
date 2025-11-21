// Basis-Typen basierend auf deinem Supabase-Schema
export interface UserProfile {
  id: string;
  display_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  primary_color: string;
  created_at: string;
  updated_at: string;
}

export interface Board {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  type: 'single' | 'multi';
  settings: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
  columns?: BoardColumn[];
}

export interface BoardColumn {
  id: string;
  board_id: string;
  name: string;
  position: number;
  color: string;
  is_done: boolean;
  created_at: string;
  cards?: Card[];
}

// Generische Karte (Datenbank-Sicht)
export interface Card {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description?: string;
  assignee_id?: string;
  due_date?: string;
  priority: 'low' | 'medium' | 'high';
  status: string;
  position: number;
  metadata: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at?: string;
  assignee?: UserProfile;
}

// --- SPEZIFISCHE TYPEN FÜR DAS PROJEKT-BOARD (Legacy Support) ---

export interface StatusEntry {
  date: string;
  message: { text: string; escalation: boolean };
  qualitaet: { text: string; escalation: boolean };
  costs: { text: string; escalation: boolean };
  termine: { text: string; escalation: boolean };
}

export interface ProjectBoardCard {
  // Identifikatoren (Supabase + Legacy)
  id?: string;       // Supabase Row ID
  card_id?: string;  // Supabase Card UUID
  UID?: string;      // Legacy ID

  // Kern-Daten (Deutsch, wie im Original-Code)
  Nummer: string;
  Teil: string;
  "Board Stage": string;
  "Status Kurz"?: string;
  Beschreibung?: string;
  
  // Zuweisung & Termine
  Verantwortlich?: string;
  "Due Date"?: string;
  Swimlane?: string;
  
  // Status & Flags
  Ampel?: string;         // "rot", "gelb", "grün"
  Eskalation?: string;    // "LK", "SK", ""
  Priorität?: boolean | string;
  Collapsed?: string;     // "1" = collapsed, "" = expanded
  Archived?: string;      // "1" = archived
  ArchivedDate?: string;

  // Technical Review (TR)
  TR_Datum?: string;
  TR_Neu?: string;
  TR_Completed?: boolean | string;
  TR_Completed_At?: string;
  TR_Completed_Date?: string;
  TR_History?: Array<{
    date: string;
    changedBy: string;
    timestamp: string;
    superseded: boolean;
  }>;

  // Start of Production
  SOP_Datum?: string;
  
  // Medien & Anhänge
  Bild?: string;
  
  // Team & Verlauf
  Team?: Array<{
    userId?: string;
    name?: string;
    email?: string;
    department?: string;
    company?: string;
    role?: string;
  }>;
  
  StatusHistory?: StatusEntry[];
  
  // Checklisten: Stage -> Item -> Boolean
  ChecklistDone?: Record<string, Record<string, boolean>>; 
  
  // Frontend-Only (wird zur Laufzeit berechnet)
  position?: number;
  order?: number;
}

export type ViewMode = 'columns' | 'swim' | 'lane';
export type LayoutDensity = 'compact' | 'xcompact' | 'large';