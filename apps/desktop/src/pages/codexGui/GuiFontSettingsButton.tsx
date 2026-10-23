import { useEffect, useState } from 'react';
import { Button, Modal, Tooltip } from 'antd';
import { Type } from 'lucide-react';
import { uiText } from '../../i18n/uiText';
import { GuiAppearanceSettings } from './GuiAppearanceSettings';

export function GuiFontSettingsButton({ active }: { active: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!active) setOpen(false); }, [active]);
  const title = uiText('client.appearance.guiFontSettings');
  return <>
    <Tooltip title={title} styles={{ root: { maxWidth: 400 } }}>
      <Button type="text" icon={<Type size={16} />} aria-label={title} onClick={() => setOpen(true)} />
    </Tooltip>
    <Modal open={open && active} title={title} onCancel={() => setOpen(false)} footer={null} width={600}>
      <GuiAppearanceSettings />
    </Modal>
  </>;
}
