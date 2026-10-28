import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { deliveryLabel, type LoungeDelivery } from '../../../../shared/lounge/delivery';
import { t } from '../i18n';

export function LoungeDeliveryStatus({ delivery }: { delivery?: LoungeDelivery }) {
  if (delivery?.direction !== 'outgoing') return null;
  const name = delivery.status === 'read' ? 'checkmark-done' : delivery.status === 'delivered' ? 'checkmark' : 'time-outline';
  return <View accessible accessibilityRole="image" accessibilityLabel={t(deliveryLabel(delivery.status))}
    style={{ alignSelf: 'flex-end', paddingTop: 4 }}>
    <Ionicons name={name} size={15} color={delivery.status === 'read' ? '#28a36b' : '#8c939d'} />
  </View>;
}
