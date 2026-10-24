use super::*;

#[derive(Debug, thiserror::Error)]
enum ProfileError {
    #[error("client.ssh.signIn")]
    Authentication,
    #[error("client.ssh.invalid")]
    Invalid,
    #[error("client.ssh.profileChanged")]
    Conflict,
    #[error("client.ssh.profileLimit")]
    Limit,
    #[error("client.ssh.syncFailed")]
    Unavailable,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SshProfile {
    id: String,
    name: String,
    host: String,
    port: u16,
    username: String,
    auth: Authentication,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    fingerprint: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    revision: Option<u64>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
enum Authentication {
    Password,
    Key,
}

/// A bounded, feature-specific command; neither URLs nor credentials come from the webview.
#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase", deny_unknown_fields)]
pub(crate) enum SshProfileRequest {
    List,
    Save { profile: SshProfile },
    Remove { id: String, revision: u64 },
    Import { profiles: Vec<SshProfile> },
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'-' | b'_'))
}

fn valid_profile(value: &SshProfile) -> bool {
    valid_id(&value.id)
        && value.port > 0
        && value.name.chars().count() <= 80
        && !value.host.is_empty()
        && value.host.len() <= 253
        && !value
            .host
            .chars()
            .any(|c| c.is_whitespace() || c.is_control())
        && !value.username.trim().is_empty()
        && value.username.chars().count() <= 256
        && !value.username.chars().any(char::is_control)
        && value.fingerprint.as_ref().is_none_or(|v| v.len() <= 256)
        && value.revision.is_none_or(|v| v <= 9_007_199_254_740_990)
}

fn request_parts(
    request: SshProfileRequest,
) -> Result<(Method, String, Option<Value>), ProfileError> {
    let path = "/sync/ssh-profiles";
    match request {
        SshProfileRequest::List => Ok((Method::GET, path.into(), None)),
        SshProfileRequest::Save { profile } if valid_profile(&profile) => Ok((
            Method::PUT,
            format!("{path}/{}", profile.id),
            Some(json!(profile)),
        )),
        SshProfileRequest::Remove { id, revision } if valid_id(&id) && revision > 0 => Ok((
            Method::DELETE,
            format!("{path}/{id}"),
            Some(json!({ "revision": revision })),
        )),
        SshProfileRequest::Import { profiles }
            if profiles.len() <= 64 && profiles.iter().all(valid_profile) =>
        {
            Ok((
                Method::POST,
                format!("{path}/import"),
                Some(json!({ "profiles": profiles })),
            ))
        }
        _ => Err(ProfileError::Invalid),
    }
}

fn exchange<R: Runtime>(
    app: &tauri::AppHandle<R>,
    identity: GuiCloudIdentity,
    request: SshProfileRequest,
) -> Result<Vec<SshProfile>, ProfileError> {
    let (method, path, body) = request_parts(request)?;
    let _guard = lock_cloud_credentials().map_err(|_| ProfileError::Unavailable)?;
    let mut settings = read_app_settings(app).map_err(|_| ProfileError::Unavailable)?;
    let mut credentials = read_cloud_credentials(app);
    if base_url(&settings).ok() != Some(identity.base_url.as_str())
        || settings.cloud_user_id.as_deref() != Some(&identity.user_id)
        || !cloud_state(&settings, &credentials).authenticated
    {
        return Err(ProfileError::Authentication);
    }
    let client = api_client().map_err(|_| ProfileError::Unavailable)?;
    let response = cloud_request(
        app,
        &client,
        &mut settings,
        &mut credentials,
        method,
        &path,
        body,
    )
    .map_err(|_| ProfileError::Unavailable)?;
    if matches!(
        response.status(),
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN
    ) {
        return Err(ProfileError::Authentication);
    }
    if !response.status().is_success() {
        let error: Value = response.json().unwrap_or(Value::Null);
        return Err(match error["message"].as_str() {
            Some("client.ssh.profileChanged") => ProfileError::Conflict,
            Some("client.ssh.profileLimit") => ProfileError::Limit,
            Some("client.ssh.invalid") => ProfileError::Invalid,
            _ => ProfileError::Unavailable,
        });
    }
    let profiles: Vec<SshProfile> = response.json().map_err(|_| ProfileError::Unavailable)?;
    if profiles.len() > 64 || !profiles.iter().all(valid_profile) {
        return Err(ProfileError::Unavailable);
    }
    Ok(profiles)
}

/// All credential locking, filesystem access and HTTP work run outside the UI thread.
#[tauri::command]
pub(crate) async fn cloud_ssh_profiles(
    app: tauri::AppHandle,
    identity: GuiCloudIdentity,
    request: SshProfileRequest,
) -> Result<Vec<SshProfile>, String> {
    tauri::async_runtime::spawn_blocking(move || exchange(&app, identity, request))
        .await
        .map_err(|_| ProfileError::Unavailable.to_string())?
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_credentials_paths_and_out_of_range_targets() {
        let input = json!({"id":"one", "name":"test", "host":"::1", "port":22,
            "username":"me", "auth":"key"});
        for key in ["password", "privateKey", "passphrase", "ownerId"] {
            let mut value = input.clone();
            value[key] = "secret".into();
            assert!(serde_json::from_value::<SshProfile>(value).is_err());
        }
        let mut profile: SshProfile = serde_json::from_value(input).unwrap();
        assert!(valid_profile(&profile));
        profile.id = "../other".into();
        assert!(!valid_profile(&profile));
        profile.id = "one".into();
        profile.port = 0;
        assert!(!valid_profile(&profile));
        assert!(request_parts(SshProfileRequest::Remove {
            id: "a?b".into(),
            revision: 1
        })
        .is_err());
    }
}
