import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { DesktopClient } from '../../../shared/remote-desktop/protocol';
import { RemoteDesktop } from '../src/chat/desktop/RemoteDesktop';
import { textMetrics } from '../src/theme/text';
import { t } from '../src/i18n';

const connectingClient: DesktopClient = {
  open: () => new Promise(() => undefined),
  signal: async () => ({ candidates: [] }),
  settings: async () => undefined,
  close: async () => undefined,
};
const permissionClient: DesktopClient = {
  ...connectingClient,
  open: async () => { throw new Error('请在 Mac 的远程设置中开启屏幕录制权限，然后重新连接。'); },
  permissionStatus: async () => ({ required: 'screenRecording' }),
};
const reconnectingClient: DesktopClient = {
  ...connectingClient,
  open: async () => { throw new Error(t('client.remoteDesktop.connectionLostReconnecting')); },
};
const clients = { connecting: connectingClient, reconnecting: reconnectingClient, permission: permissionClient };

function DesktopStatusFixture() {
  const [fonts] = useFonts({ ...Ionicons.font, ...MaterialCommunityIcons.font });
  const [scenario, setScenario] = useState<keyof typeof clients | null>(null);
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1 }}>
    <View style={{ padding: 24, gap: 24 }}>
      <Text testID="status-line-reference"
        style={textMetrics(14, 22)}>{t('client.mobile.reconnect')}</Text>
      <Pressable accessibilityRole="button" onPress={() => setScenario('connecting')}>
        <Text>Connecting status</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => setScenario('permission')}>
        <Text>Permission status</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => setScenario('reconnecting')}>
        <Text>Reconnecting status</Text>
      </Pressable>
    </View>
    {fonts && scenario && <RemoteDesktop active
      client={clients[scenario]} close={() => setScenario(null)} />}
  </SafeAreaView></SafeAreaProvider>;
}

registerRootComponent(DesktopStatusFixture);
