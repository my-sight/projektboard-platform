
import { useCallback } from 'react';
import { ProjectBoardCard, ViewMode } from '@/types';

export function useKanbanUtils(cols: any[], viewMode: ViewMode) {

    const inferStage = useCallback((r: ProjectBoardCard, colsOverride?: any[]) => {
        const s = (r["Board Stage"] || "").trim();
        const currentCols = colsOverride || cols;
        const stages = currentCols.map(c => c.name);
        if (s && stages.includes(s)) return s;
        return stages[0] || '';
    }, [cols]);

    const idFor = useCallback((r: ProjectBoardCard) => {
        if (r["UID"]) return String(r["UID"]);
        if (r.id) return String(r.id);
        if (r.card_id) return String(r.card_id);
        return [r["Nummer"], r["Teil"]].map(x => String(x || "").trim()).join(" | ");
    }, []);

    const convertDbToCard = useCallback((item: any): ProjectBoardCard => {
        let rawData = item.card_data || {};
        if (typeof rawData === 'string') {
            try { rawData = JSON.parse(rawData); } catch (e) { rawData = {}; }
        }
        const card = { ...rawData } as ProjectBoardCard;

        // Relational-First Mapping: Overwrite JSON values with dedicated DB columns if they exist
        if (item.project_number) card.Nummer = item.project_number;
        if (item.project_name) {
            card.Teil = item.project_name;
            card.title = item.project_name;
        }
        if (item.sop_date_current) card.SOP_Neu = item.sop_date_current;
        if (item.ms_date_current) card.TR_Neu = item.ms_date_current;
        if (item.assignee_id) card.assigneeId = item.assignee_id;
        if (item.due_date) card.dueDate = item.due_date;
        if (item.is_important !== undefined) card.important = !!item.is_important;
        if (item.task_description) card.description = item.task_description;
        if (item.is_completed !== undefined) {
            if (item.is_completed) card.status = 'done';
            card.TR_Completed = !!item.is_completed;
        }

        card.UID = card.UID || item.card_id || item.id;
        card.id = item.id;
        card.card_id = item.card_id;
        if (item.stage) card["Board Stage"] = item.stage;
        if (item.position !== undefined && item.position !== null) {
            card.position = item.position;
            card.order = item.position;
        }
        card.created_at = item.created;
        card.updated_at = item.updated;
        return card;
    }, []);

    const reindexByStage = useCallback((cards: ProjectBoardCard[]): ProjectBoardCard[] => {
        const byStage: Record<string, number> = {};
        return cards.map((c) => {
            const stageKey = inferStage(c);
            let groupKey = stageKey;
            if (viewMode === 'swim') {
                groupKey += '|' + ((c["Verantwortlich"] || '').trim() || '—');
            } else if (viewMode === 'lane') {
                groupKey += '|' + (c["Swimlane"] || 'Allgemein');
            }
            byStage[groupKey] = (byStage[groupKey] ?? 0) + 1;
            return { ...c, order: byStage[groupKey], position: byStage[groupKey] };
        });
    }, [viewMode, inferStage]);

    return { inferStage, idFor, convertDbToCard, reindexByStage };
}
