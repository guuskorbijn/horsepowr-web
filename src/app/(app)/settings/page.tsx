import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ThemeSelector } from '@/components/settings/ThemeSelector';
import { LanguageSelector } from '@/components/settings/LanguageSelector';
import { getServerT } from '@/i18n/server';

export default async function SettingsPage() {
  const t = await getServerT();
  return (
    <>
      <PageHeader title={t('settings.title')} description={t('settings.description')} />
      <div className="max-w-xl space-y-6">
        <Card>
          <CardHeader title={t('settings.appearanceTitle')} subtitle={t('settings.appearanceSubtitle')} />
          <CardBody>
            <ThemeSelector />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t('settings.languageTitle')} subtitle={t('settings.languageSubtitle')} />
          <CardBody>
            <LanguageSelector />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
