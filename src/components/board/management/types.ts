import { ClientProfile } from '@/lib/clientProfiles';

export interface Department {
    id: string;
    name: string;
}

export interface Member {
    id: string;
    profile_id: string;
    profile?: ClientProfile;
}

export interface AttendanceRecord {
    id: string;
    board_id: string;
    profile_id: string;
    week_start: string;
    status: 'present' | 'absent' | string;
}

export interface Topic {
    id: string;
    board_id: string;
    title: string;
    due_date: string | null;
    position: number;
}

export interface TopicDraft {
    title: string;
    dueDate: string;
}

export interface KanbanCardRow {
    id: string;
    card_id: string;
    card_data: Record<string, unknown>;
    project_number?: string | null;
    project_name?: string | null;
    board_id?: string;
}

export interface EscalationRecord {
    id?: string;
    board_id: string;
    card_id: string;
    category: 'LK' | 'SK' | 'Y' | 'R';
    project_code: string | null;
    project_name: string | null;
    reason: string | null;
    measure: string | null;
    department_id: string | null;
    responsible_id: string | null;
    target_date: string | null;
    completion_steps: number;
}

export interface EscalationView extends EscalationRecord {
    title: string;
    stage?: string | null;
}

export interface EscalationDraft {
    reason: string;
    measure: string;
    department_id: string | null;
    responsible_id: string | null;
    target_date: string | null;
    completion_steps: number;
}

export interface EscalationHistoryEntry {
    id: string;
    board_id: string;
    card_id: string;
    escalation_id: string | null;
    changed_at: string;
    changed_by: string | null;
    changes?: Record<string, unknown> | null;
}
