import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@mysight.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Passw0rd!";
  const passwordHash = await hash(adminPassword, 12);

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log("Admin-Benutzer existiert bereits", adminEmail);
    return;
  }

  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      role: Role.ADMIN,
    },
  });

  console.log(`Admin-Benutzer ${adminEmail} mit Passwort ${adminPassword} angelegt.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
