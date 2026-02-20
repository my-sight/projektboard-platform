import { checkLicenseServer } from '@/lib/license-server';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  // Server-Side License Check
  const license = await checkLicenseServer();

  if (!license.valid) {
    redirect(`/license?reason=${encodeURIComponent(license.error || 'Invalid License')}`);
  }

  return <DashboardClient />;
}
