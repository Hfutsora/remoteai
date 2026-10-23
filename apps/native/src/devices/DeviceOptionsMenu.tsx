import { useThemeColor } from '../theme/store';
import { t, useLanguage } from '../i18n';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supportsScreenControl } from '../../../../shared/remote-desktop/screenControl';
import type { RemoteDevice } from '../types';
import { deviceColors, useStyles } from './styles';

interface DeviceOptionsMenuProps {
  device: RemoteDevice | null;
  deletingDeviceId: string | null;
  switchingAuthDeviceId: string | null;
  onClose: () => void;
  onDelete: (device: RemoteDevice) => void;
  onRevokeService: (device: RemoteDevice) => void;
  onScreenControl: (device: RemoteDevice, enabled: boolean) => void;
  onSelectAuthAccount: (deviceId: string) => void;
}

export function DeviceOptionsMenu(props: DeviceOptionsMenuProps) {
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  const [confirmScreen, setConfirmScreen] = useState(false);
  useEffect(() => setConfirmScreen(false), [props.device?.deviceId]);
  const { device, deletingDeviceId, switchingAuthDeviceId, onClose, onDelete, onSelectAuthAccount } = props;
  if (!device) return null;
  const deleteDisabled = device.online || Boolean(deletingDeviceId);
  const authDisabled = !device.online || Boolean(switchingAuthDeviceId);
  return <Modal transparent visible animationType="fade" onRequestClose={onClose}
    supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}>
    <View style={styles.overlay}>
      <Pressable accessibilityLabel={t("client.git.closeMenu")} accessibilityRole="button"
        style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.menu} accessibilityViewIsModal>
        <View style={styles.menuHeader}>
          <Text style={styles.menuTitle}>{device.name}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t("client.git.closeMenu")} onPress={onClose} style={styles.close}>
            <Ionicons name="close" size={22} color={color(deviceColors.muted, 'muted')} />
          </Pressable>
        </View>
        <ScrollView style={styles.menuContent} keyboardShouldPersistTaps="handled">
        {confirmScreen ? <>
          <Text style={styles.optionLabel}>{t('client.deviceScreen.confirmTitle')}</Text>
          <Text style={styles.hintText}>{t('client.deviceScreen.confirmMessage')}</Text>
          <Pressable accessibilityRole="button" style={styles.option} onPress={() => setConfirmScreen(false)}>
            <Text style={styles.optionLabel}>{t('client.accounts.cancel')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={!device.online}
            accessibilityState={{ disabled: !device.online }}
            style={[styles.option, !device.online && styles.disabled]}
            onPress={() => { onClose(); props.onScreenControl(device, true); }}>
            <Text style={styles.optionLabel}>{t('client.deviceScreen.turnOff')}</Text>
          </Pressable>
        </> : <>
        {supportsScreenControl(device) && <>
          <Pressable accessibilityRole="button" disabled={!device.online}
            accessibilityState={{ disabled: !device.online }} onPress={() => setConfirmScreen(true)}
            style={({ pressed }) => [styles.option, pressed && styles.pressed, !device.online && styles.disabled]}>
            <Ionicons name="desktop-outline" size={21} color={color(deviceColors.green, 'accent')} />
            <Text style={styles.optionLabel}>{t('client.deviceScreen.turnOff')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={!device.online}
            accessibilityState={{ disabled: !device.online }}
            onPress={() => { onClose(); props.onScreenControl(device, false); }}
            style={({ pressed }) => [styles.option, pressed && styles.pressed, !device.online && styles.disabled]}>
            <Ionicons name="sunny-outline" size={21} color={color(deviceColors.green, 'accent')} />
            <Text style={styles.optionLabel}>{t('client.deviceScreen.restore')}</Text>
          </Pressable>
        </>}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: authDisabled }} disabled={authDisabled}
          onPress={() => { onClose(); onSelectAuthAccount(device.deviceId); }}
          style={({ pressed }) => [styles.option, pressed && styles.pressed, authDisabled && styles.disabled]}>
          <Ionicons name="open-outline" size={21} color={color(deviceColors.green, 'accent')} />
          <Text style={styles.optionLabel}>{t("client.app.proxySignInAccount")}</Text>
          {switchingAuthDeviceId === device.deviceId && <ActivityIndicator color={color(deviceColors.green, 'accent')} />}
        </Pressable>
        {device.platform.toLowerCase() === 'windows' && <Pressable accessibilityRole="button"
          onPress={() => { onClose(); props.onRevokeService(device); }} style={styles.option}>
          <Ionicons name="lock-closed-outline" size={21} color={color(deviceColors.danger, 'danger')} />
          <Text style={[styles.optionLabel, styles.danger]}>{t("client.mobile.revokeUnattendedAccess")}</Text>
        </Pressable>}
        <Pressable accessibilityRole="button"
          accessibilityState={{ disabled: deleteDisabled }} disabled={deleteDisabled}
          onPress={() => { onClose(); onDelete(device); }}
          style={({ pressed }) => [styles.option, pressed && styles.pressed, deleteDisabled && styles.disabled]}>
          <Ionicons name="trash-outline" size={21} color={color(deviceColors.danger, 'danger')} />
          <Text style={[styles.optionLabel, styles.danger]}>{device.online ? t("client.app.cannotRemoveWhileOnline") : t("client.app.removeDevice")}</Text>
          {deletingDeviceId === device.deviceId && <ActivityIndicator color={color(deviceColors.danger, 'danger')} />}
        </Pressable>
        {!device.online && <Text style={styles.hintText}>{t("client.mobile.connectTheDeviceToChangeItsProxySignInAccount")}</Text>}
        </>}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
