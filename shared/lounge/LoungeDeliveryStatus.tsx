import { Check, CheckCheck, Clock3 } from 'lucide-react';
import { displayText as t } from '../localization/messages';
import { deliveryLabel, type LoungeDelivery } from './delivery';

export function LoungeDeliveryStatus({ delivery }: { delivery?: LoungeDelivery }) {
  if (delivery?.direction !== 'outgoing') return null;
  const Icon = delivery.status === 'read' ? CheckCheck : delivery.status === 'delivered' ? Check : Clock3;
  return <span className={`lounge-delivery is-${delivery.status}`} role="img"
    aria-label={t(deliveryLabel(delivery.status))} title={t(deliveryLabel(delivery.status))}>
    <Icon size={15} aria-hidden="true" /></span>;
}
