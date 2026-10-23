import { uiText } from "../../i18n/uiText";
import { useState } from "react";
import { Button, InputNumber, Slider } from "antd";
import { RotateCcw, Type } from "lucide-react";
import {
  DEFAULT_GUI_FONT_SIZE, guiFontStyle, MAX_GUI_FONT_SIZE, MIN_GUI_FONT_SIZE, saveGuiFontSize, useGuiFontSize,
} from "./guiAppearance";
import styles from "./GuiAppearanceSettings.module.less";

export function GuiAppearanceSettings() {
  const fontSize = useGuiFontSize();
  const [error, setError] = useState("");
  const update = (value: number | null) => {
    if (value !== null) setError(saveGuiFontSize(value) ? "" : uiText("client.workspaceSettings.couldNotSaveTheFontSizePleaseTryAgain"));
  };
  return <section className={styles.panel} aria-label={uiText("client.workspaceSettings.appearanceSettings")}>
    <div className={styles.card}>
    <h3>{uiText("client.workspaceSettings.fontSize")}</h3>
    <p className={styles.hint}>{uiText("client.workspaceSettings.adjustTextSizeForConversationsTheComposerAndCodeChanges")}</p>
    <div className={styles.controls}>
      <Type size={15} className={styles.fontIcon} aria-hidden="true" />
      <Slider min={MIN_GUI_FONT_SIZE} max={MAX_GUI_FONT_SIZE} value={fontSize} onChange={update}
        ariaLabelForHandle={uiText("client.workspaceSettings.fontSize")} tooltip={{ open: false }} />
      <InputNumber aria-label={uiText("client.workspaceSettings.fontSize")} min={MIN_GUI_FONT_SIZE} max={MAX_GUI_FONT_SIZE} precision={0}
        value={fontSize} onChange={update} suffix="px" />
      <Button icon={<RotateCcw size={13} />} onClick={() => update(DEFAULT_GUI_FONT_SIZE)}
        disabled={fontSize === DEFAULT_GUI_FONT_SIZE}>
        {uiText("client.chat.restoreDefaults")}</Button>
    </div>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.preview} style={guiFontStyle(fontSize)} aria-label={uiText("client.workspaceSettings.fontPreview")}>
      <span className={styles.caption}><Type size={14} aria-hidden="true" />{uiText("client.workspaceSettings.fontPreview")}</span>
      <p>{uiText("client.workspaceSettings.helloWhatWouldYouLikeToWorkOnToday")}</p>
      <p>{uiText("client.workspaceSettings.chooseAComfortableSizeForReadingAndWriting")}</p>
      <pre><code>const message = "Hello, Codex!";</code></pre>
    </div>
  </section>;
}
