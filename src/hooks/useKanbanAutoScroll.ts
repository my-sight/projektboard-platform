import { useEffect, useRef } from 'react';

export function useKanbanAutoScroll() {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const animationFrameId = useRef<number | null>(null);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent | TouchEvent) => {
            if (!isDragging.current || !scrollContainerRef.current) return;

            const container = scrollContainerRef.current;
            const { left, right, top, bottom } = container.getBoundingClientRect();

            let clientX, clientY;

            if (e instanceof MouseEvent) {
                clientX = e.clientX;
                clientY = e.clientY;
            } else {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            }

            const edgeThreshold = 100; // Distance in pixels from edge to start scrolling
            const maxScrollSpeed = 15; // Max pixels per frame

            let scrollX = 0;
            let scrollY = 0;

            // Horizontal Scrolling
            if (clientX < left + edgeThreshold) {
                const intensity = (left + edgeThreshold - clientX) / edgeThreshold;
                scrollX = -maxScrollSpeed * intensity;
            } else if (clientX > right - edgeThreshold) {
                const intensity = (clientX - (right - edgeThreshold)) / edgeThreshold;
                scrollX = maxScrollSpeed * intensity;
            }

            // Vertical Scrolling (if needed, mostly for swimlanes)
            if (clientY < top + edgeThreshold) {
                const intensity = (top + edgeThreshold - clientY) / edgeThreshold;
                scrollY = -maxScrollSpeed * intensity;
            } else if (clientY > bottom - edgeThreshold) {
                const intensity = (clientY - (bottom - edgeThreshold)) / edgeThreshold;
                scrollY = maxScrollSpeed * intensity;
            }

            if (scrollX !== 0 || scrollY !== 0) {
                if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);

                const scroll = () => {
                    container.scrollBy(scrollX, scrollY);
                    animationFrameId.current = requestAnimationFrame(scroll);
                };
                animationFrameId.current = requestAnimationFrame(scroll);
            } else {
                if (animationFrameId.current) {
                    cancelAnimationFrame(animationFrameId.current);
                    animationFrameId.current = null;
                }
            }
        };

        // We attach these valid only when dragging starts to avoid overhead
        // But since we can't easily hook into dnd provided's events globally without prop drilling everywhere,
        // we set up global listeners that check the ref.
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('touchmove', handleMouseMove);

        // Clear animation on stop
        const stopScroll = () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
                animationFrameId.current = null;
            }
        };

        window.addEventListener('mouseup', stopScroll);
        window.addEventListener('touchend', stopScroll);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('touchmove', handleMouseMove);
            window.removeEventListener('mouseup', stopScroll);
            window.removeEventListener('touchend', stopScroll);
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        };
    }, []);

    const onDragStart = () => {
        isDragging.current = true;
    };

    const onDragEnd = () => {
        isDragging.current = false;
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
            animationFrameId.current = null;
        }
    };

    return { scrollContainerRef, onDragStart, onDragEnd };
}
