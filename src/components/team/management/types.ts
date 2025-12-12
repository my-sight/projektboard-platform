
import { ClientProfile } from '@/lib/clientProfiles';

export interface BoardMemberRow {
    id: string;
    profile_id: string;
}

export interface AttendanceRecord {
    id: string;
    board_id: string;
    profile_id: string;
    week_start: string;
    status: 'present' | 'absent' | string;
}

export interface TopicRow {
    id: string;
    board_id: string;
    title: string;
    calendar_week: string | null;
    due_date: string | null;
    position: number;
}

export interface TopicDraft {
    title: string;
    dueDate: string;
}

export interface MemberWithProfile extends BoardMemberRow {
    profile: ClientProfile | null;
}

export interface WeekHistoryItem {
    week: string;
    date: Date;
}
