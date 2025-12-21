import { checkLicenseServer } from '@/lib/license-server';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  console.log('[Home Page] Starting Server-Side License Check...');
  // Server-Side License Check
  const license = await checkLicenseServer();
  console.log(`[Home Page] License Result: valid=${license.valid}${license.valid ? '' : ', error=' + license.error}`);

  if (!license.valid) {
    console.log('[Home Page] Redirecting to /license due to invalid license');
    redirect(`/license?reason=${encodeURIComponent(license.error || 'Invalid License')}`);
  }

  console.log('[Home Page] License VALID - Rendering Dashboard');
  return <DashboardClient />;
}

