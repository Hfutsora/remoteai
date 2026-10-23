import type { MessageKey } from '@remoteai/i18n';
import { displayError } from '../../i18n/index';
import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import type { ForwardingEntry, PortForwardingService } from '../../../../../shared/port-mapping/service';
import { DEFAULT_MAPPING_HOST } from '../../../../../shared/port-mapping/target';
import { protocolLabel } from '../../../../../shared/port-mapping/settings';
import { t, useLanguage } from '../../i18n';
import { useMappingStyles } from './mappingStyles';

export function MappingRow({ entry, service, connected, open, edit }: {
  entry: ForwardingEntry; service: PortForwardingService; connected: boolean; open: () => void; edit: () => void;
}) {
  const styles = useMappingStyles();
  useLanguage();
  const [notice, setNotice] = useState('');
  const [menu, setMenu] = useState(false);
  const running = entry.status === 'running';
  const canOpen = running && entry.protocol !== 'udp';
  const busy = entry.status === 'starting' || entry.status === 'stopping';
  const copy = async () => {
    try { await Clipboard.setStringAsync(`127.0.0.1:${entry.localPort}`); setNotice('本地地址已复制'); }
    catch { setNotice('复制失败，请重试。'); }
  };
  const details: Array<[MessageKey, string | number]> = [["client.portForwarding.protocol", protocolLabel(entry.protocol)], ["client.portForwarding.targetIp", entry.remoteHost || DEFAULT_MAPPING_HOST],
    ["client.portForwarding.remotePort", entry.remotePort],
    ["client.portForwarding.localPort", entry.localPort], ["client.portMappingEditing.lastEdited.4f04ab", entry.updatedAt
      ? new Date(entry.updatedAt).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit',
        minute: '2-digit' }) : '—']];
  return <View style={styles.card}>
    <View style={styles.accessSection}>
      <View style={styles.row}>
        <Text style={styles.addressLabel}>{t("client.portMappingEditing.accessAddress")}</Text>
        <Switch accessibilityLabel={t(running || busy ? "client.portForwarding.stopMapping" : "client.portForwarding.startMapping")} value={running || busy}
          disabled={entry.status === 'stopping' || (!connected && !running && !busy)}
          trackColor={{ false: '#ccd5dc', true: '#008b73' }} thumbColor="#fff"
          onValueChange={() => { void (running || busy ? service.stop(entry.id) : service.start(entry.id)); }} />
        <Pressable accessibilityRole="button" accessibilityLabel={t("client.portMappingEditing.moreActions")} accessibilityState={{ expanded: menu }}
          style={styles.iconButton} onPress={() => setMenu(!menu)}>
          <Ionicons name="ellipsis-vertical" size={20} color="#718078" /></Pressable>
      </View>
      {menu && <View style={styles.menu}>
        <Pressable accessibilityRole="button" style={styles.button} disabled={busy}
          onPress={() => { setMenu(false); edit(); }}><Text style={styles.buttonText}>{t("client.portMappingEditing.editMapping")}</Text></Pressable>
        <Pressable accessibilityRole="button" style={styles.button} disabled={entry.status === 'stopping'}
          onPress={() => { void service.remove(entry.id); }}><Text style={styles.error}>{t("client.portForwarding.removeMapping")}</Text></Pressable>
      </View>}
      <View style={styles.row}>
        <View style={styles.addressBox}>
          <Pressable accessibilityRole="button" accessibilityLabel={`127.0.0.1:${entry.localPort}`}
            disabled={!canOpen} onPress={open} style={[styles.fill, !running && styles.disabled]}>
            <Text style={styles.addressText}>127.0.0.1:{entry.localPort}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t("client.portForwarding.copyLocalAddress")}
            style={styles.iconButton} onPress={() => { void copy(); }}>
            <Ionicons name="copy-outline" size={19} color="#62768a" /></Pressable>
        </View>
        {entry.protocol !== 'udp' && <Pressable accessibilityRole="button" accessibilityLabel={t("client.portForwarding.open")} disabled={!running}
          style={[styles.open, !running && styles.disabled]} onPress={open}>
          <Ionicons name="open-outline" size={19} color="#008b73" /><Text style={styles.openText}>{t("client.portForwarding.open")}</Text>
        </Pressable>}
      </View>
    </View>
    <View style={styles.metadata}>{details.map(([label, value]) => <View key={label} style={styles.detail}>
      <Text style={styles.muted}>{t(label)}</Text><Text style={styles.value}>{value}</Text></View>)}</View>
    {!!entry.error && <Text accessibilityRole="alert" style={styles.error}>{displayError(entry.error)}</Text>}
    {!!notice && <Text style={styles.muted}>{displayError(notice)}</Text>}
  </View>;
}
