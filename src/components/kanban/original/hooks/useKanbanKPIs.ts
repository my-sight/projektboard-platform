
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
    memberDistribution: Record<string, number>;
    laneDistribution: Record<string, number>;
    totalTrDeviation: number;
    nextTrs: ProjectBoardCard[];
    nextSops: ProjectBoardCard[];
    nextKeyDates: { card: ProjectBoardCard; title: string; date: Date; dateStr: string }[];
}

export function useKanbanKPIs(rows: ProjectBoardCard[], inferStage: (card: ProjectBoardCard) => string, profiles: any[] = []) {

    const calculateKPIs = useCallback((): KanbanKPIs => {
        const activeCards = rows.filter(card => card["Archived"] !== "1" && card["Board Stage"] !== "Fertig");
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
            memberDistribution: {},
            laneDistribution: {},
            totalTrDeviation: 0,
            nextTrs: [],
            nextSops: [],
            nextKeyDates: []
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

            // KPI: Overdue (Based on "Due Date" / "Fällig am")
            // Requirement update: Decoupled from TR status. Independent check.
            const dueDateStr = card["Due Date"];
            if (dueDateStr) {
                const dueDate = nullableDate(dueDateStr);
                if (dueDate) {
                    dueDate.setHours(0, 0, 0, 0);

                    if (dueDate < now) {
                        kpis.trOverdue.push(card);
                    } else if (dueDate.toISOString().split('T')[0] === todayStr) {
                        kpis.trToday.push(card);
                    } else if (dueDate <= endOfWeek) {
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

            const rawMember = card.Verantwortlich ? String(card.Verantwortlich).trim() : 'Unzugewiesen';
            // Try to resolve full name from profiles if the current string matches an alias or name
            let resolvedName = rawMember;
            if (profiles.length > 0 && rawMember !== 'Unzugewiesen') {
                const p = profiles.find(u =>
                    (u.full_name && u.full_name.trim() === rawMember) ||
                    (u.alias && u.alias.trim() === rawMember) ||
                    (u.name && u.name.trim() === rawMember)
                );
                if (p && p.full_name) resolvedName = p.full_name;
            }
            kpis.memberDistribution[resolvedName] = (kpis.memberDistribution[resolvedName] || 0) + 1;

            // Corrected Lane Logic: Use "Swimlane" field
            const lane = (card as any)["Swimlane"] ? String((card as any)["Swimlane"]).trim() : 'Nicht zugeordnet';
            kpis.laneDistribution[lane] = (kpis.laneDistribution[lane] || 0) + 1;
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

        // Calculate Next 3 SOPs
        kpis.nextSops = activeCards
            .map(card => {
                const original = nullableDate(card["SOP_Datum"]);
                const current = nullableDate(card["SOP_Neu"]);
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

        // Calculate Next Key Dates (Kerntermine)
        const allKeyDates: any[] = [];
        activeCards.forEach(card => {
            if (card && card.Kerntermine && Array.isArray(card.Kerntermine)) {
                card.Kerntermine.forEach(kt => {
                    if (kt && kt.date) {
                        const d = nullableDate(kt.date);
                        if (d && d >= now) {
                            allKeyDates.push({
                                card,
                                title: kt.title || 'Termin', // Fallback title
                                date: d,
                                dateStr: kt.date
                            });
                        }
                    }
                });
            }
        });

        // Sort by date ASC and take top 5
        kpis.nextKeyDates = allKeyDates
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .slice(0, 5);

        return kpis;
    }, [rows, inferStage, profiles]);

    const kpis = useMemo(() => calculateKPIs(), [calculateKPIs]);

    const distribution = useMemo(() => {
        const dist = Object.entries(kpis.columnDistribution).map(([name, count]) => ({ name, count: count as number }));
        dist.sort((a, b) => {
            const pos = (name: string) => DEFAULT_COLS.findIndex((c) => c.name === name);
            return pos(a.name) - pos(b.name);
        });
        return dist;
    }, [kpis.columnDistribution]);

    const memberDistribution = useMemo(() => {
        const dist = Object.entries(kpis.memberDistribution).map(([name, count]) => ({ name, count: count as number }));
        dist.sort((a, b) => b.count - a.count); // Descending by count
        return dist;
    }, [kpis.memberDistribution]);

    const laneDistribution = useMemo(() => {
        const dist = Object.entries(kpis.laneDistribution).map(([name, count]) => ({ name, count: count as number }));
        dist.sort((a, b) => {
            if (a.name === 'Nicht zugeordnet') return 1;
            if (b.name === 'Nicht zugeordnet') return -1;
            return b.count - a.count;
        });
        return dist;
    }, [kpis.laneDistribution]);

    const kpiBadgeCount = useMemo(() => {
        return kpis.trOverdue.length + kpis.rEscalations.length;
    }, [kpis]);

    return { kpis, distribution, memberDistribution, laneDistribution, kpiBadgeCount };
}
