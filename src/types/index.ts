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

export interface CardAttachment {
  id: string;
  card_id: string;
  filename: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  uploaded_by: string;
  created_at: string;
}

export interface Activity {
  id: string;
  board_id: string;
  card_id?: string;
  user_id: string;
  action: string;
  details: Record<string, any>;
  created_at: string;
}

// Erweiterte Typen für UI-Features
export interface ExtendedCard extends Card {
  collapsed?: boolean;
  escalation?: 'LK' | 'SK' | null;
  swimlane?: string;
  status_history?: StatusEntry[];
  checklist_done?: Record<string, boolean[]>;
}

export interface StatusEntry {
  date: string;
  message: { text: string; escalation: boolean };
  quality: { text: string; escalation: boolean };
  costs: { text: string; escalation: boolean };
  deadlines: { text: string; escalation: boolean };
}

export type ViewMode = 'columns' | 'swimlanes-responsible' | 'swimlanes-category';
export type LayoutDensity = 'compact' | 'normal' | 'large';
