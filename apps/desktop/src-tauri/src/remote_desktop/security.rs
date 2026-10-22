//! Session-scoped security survives viewer loss and is released with the last retained display.
use super::{DesktopError, Result};
use serde::{Deserialize, Serialize};

#[cfg(windows)]
#[path = "security/windows.rs"]
mod platform;

#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Snapshot {
    pub lock_on_disconnect: bool,
    pub mute_host: bool,
}

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Change {
    lock_on_disconnect: Option<bool>,
    mute_host: Option<bool>,
}

#[cfg(windows)]
#[derive(Default)]
struct State {
    snapshot: Snapshot,
    muted: Option<platform::MutedEndpoint>,
}

/// All captures in a viewer group share one cleanup owner; switching monitors never locks the PC.
#[cfg(windows)]
#[derive(Clone, Default)]
pub(super) struct Guard(std::sync::Arc<std::sync::Mutex<State>>);

#[cfg(windows)]
impl Guard {
    pub(super) fn snapshot(&self) -> Result<Snapshot> {
        Ok(self.0.lock().map_err(|_| DesktopError::Platform)?.snapshot)
    }

    fn apply(&self, change: Change) -> Result<Snapshot> {
        let mut state = self.0.lock().map_err(|_| DesktopError::Platform)?;
        if let Some(mute) = change.mute_host {
            if mute && state.muted.is_none() {
                state.muted = Some(platform::MutedEndpoint::acquire()?);
            } else if !mute {
                if let Some(endpoint) = state.muted.as_ref() {
                    endpoint.restore()?;
                }
                state.muted = None;
            }
            state.snapshot.mute_host = mute;
        }
        if let Some(lock) = change.lock_on_disconnect {
            state.snapshot.lock_on_disconnect = lock;
        }
        Ok(state.snapshot)
    }
}

#[cfg(windows)]
impl Drop for State {
    fn drop(&mut self) {
        if let Some(endpoint) = self.muted.take() {
            if let Err(error) = endpoint.restore() {
                eprintln!("desktop security audio cleanup: {error}");
            }
        }
        if self.snapshot.lock_on_disconnect {
            if let Err(error) = platform::lock() {
                eprintln!("desktop security lock cleanup: {error}");
            }
        }
    }
}

fn apply(id: &str, change: Change) -> Result<Snapshot> {
    super::with_lease(id, |session| {
        if !session.permissions.control
            || (change.mute_host == Some(true) && !session.permissions.audio)
        {
            return Err(DesktopError::Denied);
        }
        #[cfg(windows)]
        return session.security.apply(change);
        #[cfg(not(windows))]
        Err(DesktopError::Platform)
    })
}

#[tauri::command]
pub(crate) async fn remote_desktop_security(
    id: String,
    change: Change,
) -> std::result::Result<Snapshot, String> {
    #[cfg(windows)]
    if crate::desktop_service::delegation::delegated(&id) {
        return crate::desktop_service::delegation::call(
            "remote_desktop_security",
            &id,
            serde_json::json!({ "change": change }),
        )
        .await;
    }
    tauri::async_runtime::spawn_blocking(move || apply(&id, change))
        .await
        .map_err(|_| "安全选项未能保存，请重试。".to_owned())?
        .map_err(|_| "安全选项未能保存，请重试。".to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn security_changes_reject_unknown_or_non_boolean_values() {
        for value in [
            serde_json::json!({"muteHost": "true"}),
            serde_json::json!({"unlock": true}),
        ] {
            assert!(serde_json::from_value::<Change>(value).is_err());
        }
        assert!(
            serde_json::from_value::<Change>(serde_json::json!({"lockOnDisconnect": true})).is_ok()
        );
    }

    #[cfg(windows)]
    #[test]
    fn retained_displays_share_security_without_resetting_it() {
        let first = Guard::default();
        let second = first.clone();
        let enabled = Change {
            lock_on_disconnect: Some(true),
            mute_host: None,
        };
        assert!(first.apply(enabled).unwrap().lock_on_disconnect);
        drop(first);
        assert!(second.snapshot().unwrap().lock_on_disconnect);
        // Disable before dropping the final owner: tests must never lock the developer's PC.
        second
            .apply(Change {
                lock_on_disconnect: Some(false),
                mute_host: None,
            })
            .unwrap();
    }
}
