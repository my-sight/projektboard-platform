import { PrismaClient } from "@prisma/client";
import { subMonths } from "date-fns";

const prisma = new PrismaClient();

async function cleanup() {
  const threshold = subMonths(new Date(), 6);
  const result = await prisma.subTaskCard.deleteMany({
    where: {
      archivedAt: {
        lt: threshold,
      },
    },
  });
  console.log(`[cleanup] Entfernte ${result.count} archivierte Tasks vor ${threshold.toISOString()}`);
}

cleanup()
  .catch((error) => {
    console.error("Archiv-Cleanup fehlgeschlagen", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
