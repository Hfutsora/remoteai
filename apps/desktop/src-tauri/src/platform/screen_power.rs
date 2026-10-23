//! Physical monitor power commands do not open, capture, or lock the desktop.
use serde::Deserialize;

#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Action {
    Off,
    On,
}

#[derive(Debug, thiserror::Error)]
pub(crate) enum Error {
    #[error("monitor power command unavailable")]
    Unavailable,
}

/// Called from the device control worker, never from the UI message thread.
pub(crate) fn set(action: Action) -> Result<(), Error> {
    #[cfg(windows)]
    return windows::set(action);
    #[cfg(not(windows))]
    {
        let _ = action;
        Err(Error::Unavailable)
    }
}

#[cfg(windows)]
mod windows {
    use super::{Action, Error};
    use ::windows::{
        core::w,
        Win32::{
            Foundation::{LPARAM, WPARAM},
            UI::WindowsAndMessaging::{
                FindWindowW, GetDesktopWindow, SendMessageTimeoutW, SC_MONITORPOWER,
                SMTO_ABORTIFHUNG, SMTO_ERRORONEXIT, WM_SYSCOMMAND,
            },
        },
    };

    const COMMAND_TIMEOUT_MS: u32 = 2_000;
    const MONITOR_OFF: isize = 2;
    const MONITOR_ON: isize = -1;

    pub(super) fn set(action: Action) -> Result<(), Error> {
        // SAFETY: HWNDs are obtained from Windows, the message carries only fixed integer
        // values, and SendMessageTimeout bounds waiting on the shell's message thread.
        let result = unsafe {
            let target = FindWindowW(w!("Progman"), None).unwrap_or_else(|_| GetDesktopWindow());
            SendMessageTimeoutW(
                target,
                WM_SYSCOMMAND,
                WPARAM(SC_MONITORPOWER as usize),
                LPARAM(match action {
                    Action::Off => MONITOR_OFF,
                    Action::On => MONITOR_ON,
                }),
                SMTO_ABORTIFHUNG | SMTO_ERRORONEXIT,
                COMMAND_TIMEOUT_MS,
                None,
            )
        };
        if result.0 == 0 {
            Err(Error::Unavailable)
        } else {
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Action;

    #[test]
    fn accepts_only_explicit_monitor_power_actions() {
        assert_eq!(
            serde_json::from_str::<Action>(r#""off""#).unwrap(),
            Action::Off
        );
        assert_eq!(
            serde_json::from_str::<Action>(r#""on""#).unwrap(),
            Action::On
        );
        for input in [r#""toggle""#, r#""sleep""#, "false", "null", "2"] {
            assert!(serde_json::from_str::<Action>(input).is_err());
        }
    }
}
