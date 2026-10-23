import { uiText } from "../../i18n/uiText";
import type { ReactElement } from "react";
import { App, Dropdown, type MenuProps } from "antd";
import { MoreHorizontal, Pin, PinOff, X } from "lucide-react";
import type { GuiController } from "./controller";
import type { GuiState } from "./types";
import styles from "./ThreadGroup.module.less";

export function ProjectGroupMenu({ path, label, state, controller, children }: {
  path: string; label: string; state: GuiState; controller: GuiController; children: ReactElement;
}) {
  const { message } = App.useApp();
  const pinned = state.pinnedProjects.includes(path);
  const remove = async () => {
    if (await controller.projectActions.remove(path)) {
      void message.success(<span className="compact-confirm-copy">{uiText("client.conversation.projectRemovedItsConversationsAreNowInRecent")}</span>);
    }
  };
  const menu: MenuProps = { items: [
    { key: "pin", label: pinned ? uiText("client.conversation.unpin") : uiText("client.conversation.pin"), icon: pinned ? <PinOff size={16} /> : <Pin size={16} /> },
    { type: "divider" },
    { key: "remove", label: state.removingProject === path ? uiText("client.conversation.removing") : uiText("client.conversation.removeProject"), icon: <X size={16} />,
      disabled: state.sending || Boolean(state.removingProject) || state.connection !== "ready" },
  ], onClick: ({ key }) => {
    if (key === "pin") controller.projectActions.pin(path);
    if (key === "remove") void remove();
  } };
  return <>
    <Dropdown trigger={["contextMenu"]} overlayStyle={{ maxWidth: 400 }} menu={menu}>
      {children}
    </Dropdown>
    <Dropdown trigger={["click"]} overlayStyle={{ maxWidth: 400 }} menu={menu}>
      <button type="button" className={styles.add} aria-label={uiText("client.conversation.manageProject", { value1: label })}>
        <MoreHorizontal size={14} aria-hidden="true" />
      </button>
    </Dropdown>
  </>;
}
