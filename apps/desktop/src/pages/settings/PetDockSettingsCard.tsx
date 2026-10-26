import { Button, Switch } from 'antd';
import { PawPrint } from 'lucide-react';
import { usePetDock } from '../../../../../shared/pet-dock/usePetDock';
import { petDockApi } from '../../api/petDock';
import type { Translate } from '../../i18n';
import styles from './PetDockSettingsCard.module.less';

export function PetDockSettingsCard({ t }: { t: Translate }) {
  const { status, saving, error, update, updateLabels, refresh } = usePetDock(petDockApi);
  const unavailable = !status || saving || status.state === 'unsupported';
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
      <div className={styles.controls}>
        <div className={`settings-field ${styles.toggle}`}>
          <label htmlFor="pet-quota-dock">{t('settings.petDock.enabled')}</label>
          <Switch id="pet-quota-dock" checked={status?.enabled ?? false} loading={!status || saving}
            disabled={unavailable}
            checkedChildren={t('settings.autoRefresh.on')} unCheckedChildren={t('settings.autoRefresh.off')}
            onChange={(enabled) => void update(enabled)} />
        </div>
        <div className={`settings-field ${styles.toggle}`}>
          <label htmlFor="pet-quota-dock-labels">{t('settings.petDock.showLabels')}</label>
          <Switch id="pet-quota-dock-labels" checked={status?.showLabels ?? false} loading={saving}
            disabled={unavailable || !status?.enabled}
            checkedChildren={t('settings.autoRefresh.on')} unCheckedChildren={t('settings.autoRefresh.off')}
            onChange={(showLabels) => void updateLabels(showLabels)} />
        </div>
      </div>
    </div>
  </section>;
}
