import { Button, Switch } from 'antd';
import { PawPrint } from 'lucide-react';
import { usePetDock } from '../../../../../shared/pet-dock/usePetDock';
import { petDockApi } from '../../api/petDock';
import type { Translate } from '../../i18n';

export function PetDockSettingsCard({ t }: { t: Translate }) {
  const { status, saving, error, update, refresh } = usePetDock(petDockApi);
  return <section className="settings-card">
    <div className="settings-icon"><PawPrint size={23} /></div>
    <div className="settings-card-content">
      <div className="settings-card-copy">
        <h3>{t('settings.petDock.title')}</h3>
        <p>{t('settings.petDock.description')}</p>
        <p>{t('settings.petDock.metrics')}</p>
        <p role="status" style={{ maxWidth: 400, overflowWrap: 'anywhere' }}>
          {t(`settings.petDock.${status?.state ?? 'loading'}`)}
        </p>
        {error && <p role="alert" style={{ maxWidth: 400 }}>
          {t(`settings.petDock.${error}`)} <Button size="small" onClick={() => void refresh()}>
            {t('settings.petDock.retry')}
          </Button>
        </p>}
      </div>
      <div className="settings-field">
        <label htmlFor="pet-quota-dock">{t('settings.petDock.enabled')}</label>
        <Switch id="pet-quota-dock" checked={status?.enabled ?? false} loading={!status || saving}
          disabled={!status || saving || status.state === 'unsupported'}
          checkedChildren={t('settings.autoRefresh.on')} unCheckedChildren={t('settings.autoRefresh.off')}
          onChange={(enabled) => void update(enabled)} />
      </div>
    </div>
  </section>;
}
