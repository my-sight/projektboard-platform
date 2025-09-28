import { AppShell } from "@/components/layout/app-shell";
import { BoardView } from "@/components/board/board-view";

interface PageProps {
  params: { boardId: string };
}

export default function BoardPage({ params }: PageProps) {
  return (
    <AppShell>
      <BoardView boardId={params.boardId} />
    </AppShell>
  );
}
