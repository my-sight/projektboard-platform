
import { useCallback } from 'react';
import { ProjectBoardCard, ViewMode } from '@/types';

export function useKanbanUtils(cols: any[], viewMode: ViewMode) {

    const inferStage = useCallback((r: ProjectBoardCard) => {
        const s = (r["Board Stage"] || "").trim();
        const stages = cols.map(c => c.name);
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
        const card = { ...(item.card_data || {}) } as ProjectBoardCard;
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
