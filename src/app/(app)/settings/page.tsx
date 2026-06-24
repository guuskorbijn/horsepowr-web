import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ThemeSelector } from '@/components/settings/ThemeSelector';

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Appearance and app preferences." />
      <Card className="max-w-xl">
        <CardHeader title="Appearance" subtitle="Choose how HorsePowr looks on this device." />
        <CardBody>
          <ThemeSelector />
        </CardBody>
      </Card>
    </>
  );
}
