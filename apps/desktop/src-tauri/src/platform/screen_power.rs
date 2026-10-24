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
            System::Power::{SetThreadExecutionState, ES_DISPLAY_REQUIRED},
            UI::WindowsAndMessaging::{
                FindWindowW, GetDesktopWindow, SendMessageTimeoutW, SC_MONITORPOWER,
                SMTO_ABORTIFHUNG, SMTO_ERRORONEXIT, WM_SYSCOMMAND,
            },
        },
    };

    const COMMAND_TIMEOUT_MS: u32 = 2_000;
    const MONITOR_OFF: isize = 2;

    pub(super) fn set(action: Action) -> Result<(), Error> {
        match action {
            Action::Off => turn_off(),
            Action::On => restore(),
        }
    }

    fn restore() -> Result<(), Error> {
        // SC_MONITORPOWER alone leaves the display idle timer expired, so Windows
        // can immediately turn the monitor off again. A one-shot display request
        // wakes it and resets that timer without overriding the user's power plan.
        // SAFETY: This call takes only a documented flag and no pointers. Omitting
        // ES_CONTINUOUS leaves no persistent requirement on the control worker.
        let previous = unsafe { SetThreadExecutionState(ES_DISPLAY_REQUIRED) };
        if previous.0 == 0 {
            Err(Error::Unavailable)
        } else {
            Ok(())
        }
    }

    fn turn_off() -> Result<(), Error> {
        // SAFETY: HWNDs are obtained from Windows, the message carries only fixed integer
        // values, and SendMessageTimeout bounds waiting on the shell's message thread.
        let result = unsafe {
            let target = FindWindowW(w!("Progman"), None).unwrap_or_else(|_| GetDesktopWindow());
            SendMessageTimeoutW(
                target,
                WM_SYSCOMMAND,
                WPARAM(SC_MONITORPOWER as usize),
                LPARAM(MONITOR_OFF),
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
