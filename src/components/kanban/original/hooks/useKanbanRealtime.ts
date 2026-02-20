import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

export const useKanbanRealtime = (
    boardId: string,
    setRows: React.Dispatch<React.SetStateAction<any[]>>,
    convertDbToCard: (item: any) => any,
    isDisabled: boolean = false
) => {
    // We use a ref to track the disabled state within the persistent event listener
    const disabledRef = useRef(isDisabled);
    useEffect(() => {
        disabledRef.current = isDisabled;
    }, [isDisabled]);

    useEffect(() => {
        if (!boardId) return;

        console.log('🔌 Subscribing to Realtime for Board:', boardId);

        const channel = supabase
            .channel(`board-${boardId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'kanban_cards',
                    filter: `board_id=eq.${boardId}`
                },
                (payload) => {
                    // Check the ref IMMEDIATELY to swallow events during saves
                    if (disabledRef.current) {
                        return;
                    }

                    if (payload.eventType === 'INSERT') {
                        const newCard = payload.new;
                        const formatted = convertDbToCard(newCard);
                        setRows((prev) => {
                            if (prev.some(r => r.id === newCard.id)) return prev;
                            return [...prev, formatted];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedCard = payload.new;
                        const formatted = convertDbToCard(updatedCard);
                        setRows((prev) =>
                            prev.map((row) => (row.id === updatedCard.id ? formatted : row))
                        );
                    } else if (payload.eventType === 'DELETE') {
                        const deletedId = payload.old.id;
                        setRows((prev) => prev.filter((row) => row.id !== deletedId));
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Realtime Subscribed!');
                }
            });

        return () => {
            console.log('🔌 Unsubscribing Realtime...');
            supabase.removeChannel(channel);
        };
    }, [boardId, setRows, convertDbToCard]);
};
