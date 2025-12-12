
import { useMemo, useCallback } from 'react';
import { ProjectBoardCard } from '@/types';
import { nullableDate, toBoolean } from '@/utils/booleans';
import { DEFAULT_COLS } from '../constants';

export interface KanbanKPIs {
    totalCards: number;
    trOverdue: ProjectBoardCard[];
    trToday: ProjectBoardCard[];
    trThisWeek: ProjectBoardCard[];
    ampelRed: number;
    ampelYellow: number;
    ampelGreen: number;
    ampelNeutral: number;
    rEscalations: ProjectBoardCard[];
    columnDistribution: Record<string, number>;
    totalTrDeviation: number;
    nextTrs: ProjectBoardCard[];
}

export function useKanbanKPIs(rows: ProjectBoardCard[], inferStage: (card: ProjectBoardCard) => string) {

    const calculateKPIs = useCallback((): KanbanKPIs => {
        const activeCards = rows.filter(card => card["Archived"] !== "1");
        const kpis: KanbanKPIs = {
            totalCards: activeCards.length,
            trOverdue: [],
            trToday: [],
            trThisWeek: [],
            ampelRed: 0,
            ampelYellow: 0,
            ampelGreen: 0,
            ampelNeutral: 0,
            rEscalations: [],
            columnDistribution: {},
            totalTrDeviation: 0,
            nextTrs: []
        };

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const todayStr = now.toISOString().split('T')[0];

        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() + (6 - now.getDay()));
        endOfWeek.setHours(23, 59, 59, 999);

        activeCards.forEach(card => {
            const ampel = String(card.Ampel || '').toLowerCase();
            if (ampel === 'rot') kpis.ampelRed++;
            else if (ampel === 'gelb') kpis.ampelYellow++;
            else if (ampel === 'grün') kpis.ampelGreen++;
            else kpis.ampelNeutral++;

            const eskalation = String(card.Eskalation || '').toUpperCase();
            if (eskalation === 'R' || eskalation === 'SK') kpis.rEscalations.push(card);

            const trDateStr = card['TR_Neu'] || card['TR_Datum'];
            const trCompleted = toBoolean(card.TR_Completed);

            if (trDateStr && !trCompleted) {
                const trDate = nullableDate(trDateStr);
                if (trDate) {
                    trDate.setHours(0, 0, 0, 0);

                    if (trDate < now) {
                        kpis.trOverdue.push(card);
                    } else if (trDate.toISOString().split('T')[0] === todayStr) {
                        kpis.trToday.push(card);
                    } else if (trDate <= endOfWeek) {
                        kpis.trThisWeek.push(card);
                    }
                }
            }

            const original = nullableDate(card["TR_Datum"]);
            const current = nullableDate(card["TR_Neu"]);
            if (original && current) {
                const diffTime = current.getTime() - original.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                kpis.totalTrDeviation += diffDays;
            }

            const stage = inferStage(card);
            kpis.columnDistribution[stage] = (kpis.columnDistribution[stage] || 0) + 1;
        });

        // Calculate Next 3 TRs
        kpis.nextTrs = activeCards
            .map(card => {
                const original = nullableDate(card["TR_Datum"]);
                const current = nullableDate(card["TR_Neu"]);
                const effectiveDate = current || original;
                return { card, original, current, effectiveDate };
            })
            .filter(item => item.effectiveDate && item.effectiveDate >= now)
            .sort((a, b) => (a.effectiveDate!.getTime() - b.effectiveDate!.getTime()))
            .slice(0, 3)
            .map(item => ({
                ...item.card,
                _originalDate: item.original,
                _currentDate: item.current,
                _effectiveDate: item.effectiveDate
            }));

        return kpis;
    }, [rows, inferStage]);

    const kpis = useMemo(() => calculateKPIs(), [calculateKPIs]);

    const distribution = useMemo(() => {
        const dist = Object.entries(kpis.columnDistribution).map(([name, count]) => ({ name, count: count as number }));
        dist.sort((a, b) => {
            const pos = (name: string) => DEFAULT_COLS.findIndex((c) => c.name === name);
            return pos(a.name) - pos(b.name);
        });
        return dist;
    }, [kpis.columnDistribution]);

    const kpiBadgeCount = useMemo(() => {
        return kpis.trOverdue.length + kpis.rEscalations.length;
    }, [kpis]);

    return { kpis, distribution, kpiBadgeCount };
}
