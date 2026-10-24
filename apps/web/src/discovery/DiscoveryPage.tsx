import { BarChart3, ChevronLeft, ChevronRight, Download, Server, ShieldCheck } from 'lucide-react';
import { discoveryEntries, type DiscoveryPage as DiscoveryDestination } from '../../../../shared/navigation/discovery';
import { t, useLanguage } from '../i18n';
import { DownloadCountIcon } from '../downloads/DownloadCountIcon';
import './styles.css';

const entryIcons = { devices: Server, totp: ShieldCheck, downloads: Download, 'token-summary': BarChart3 };

export function DiscoveryPage({ owner, onOpen }: {
  owner?: string;
  onOpen: (page: DiscoveryDestination) => void;
}) {
  useLanguage();
  return <section className="discovery-page" aria-labelledby="discovery-title">
    <header className="discovery-header"><h1 id="discovery-title">{t('client.discovery.title')}</h1></header>
    <div className="discovery-list">
      {discoveryEntries.map(entry => {
        const Icon = entryIcons[entry.page];
        return <button key={entry.page} type="button" className={`discovery-row discovery-${entry.page}`}
          onClick={() => onOpen(entry.page)}>
          {entry.page === 'downloads'
            ? <DownloadCountIcon owners={[owner]} target><Icon size={25} aria-hidden="true" /></DownloadCountIcon>
            : <Icon size={25} aria-hidden="true" />}
          <span>{t(entry.label)}</span>
          <ChevronRight className="discovery-chevron" size={20} aria-hidden="true" />
        </button>;
      })}
    </div>
  </section>;
}

export function DiscoveryBackButton({ onBack }: { onBack: () => void }) {
  useLanguage();
  return <button type="button" className="discovery-back" aria-label={t('client.discovery.back')} onClick={onBack}>
    <ChevronLeft size={22} aria-hidden="true" /><span>{t('client.discovery.title')}</span>
  </button>;
}
