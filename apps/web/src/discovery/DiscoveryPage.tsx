import { ChevronLeft, ChevronRight, Server, ShieldCheck } from 'lucide-react';
import { discoveryEntries, type DiscoveryPage as DiscoveryDestination } from '../../../../shared/navigation/discovery';
import { t, useLanguage } from '../i18n';
import './styles.css';

export function DiscoveryPage({ onOpen }: { onOpen: (page: DiscoveryDestination) => void }) {
  useLanguage();
  return <section className="discovery-page" aria-labelledby="discovery-title">
    <header className="discovery-header"><h1 id="discovery-title">{t('client.discovery.title')}</h1></header>
    <div className="discovery-list">
      {discoveryEntries.map(entry => {
        const Icon = entry.page === 'devices' ? Server : ShieldCheck;
        return <button key={entry.page} type="button" className={`discovery-row discovery-${entry.page}`}
          onClick={() => onOpen(entry.page)}>
          <Icon size={25} aria-hidden="true" />
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
