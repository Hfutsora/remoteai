use super::*;

#[test]
fn rejects_invalid_endpoints_sizes_and_paths() {
    for host in ["", "host\nname", "user@host", "host/path"] {
        assert!(Endpoint {
            host: host.into(),
            port: 22
        }
        .validate()
        .is_err());
    }
    assert!(Endpoint {
        host: "::1".into(),
        port: 22
    }
    .validate()
    .is_ok());
    assert!(Endpoint {
        host: "localhost".into(),
        port: 0
    }
    .validate()
    .is_err());
    for (cols, rows) in [(0, 24), (80, 0), (501, 24)] {
        assert!(Size { cols, rows }.validate().is_err());
    }
    for path in ["", "/tmp/a\0b", "/tmp/a\nb"] {
        assert!(crate::files::validate_path(path).is_err());
    }
    assert!(crate::files::validate_path("/home/用户/my file.txt").is_ok());
}

#[tokio::test]
async fn closed_sessions_reject_input_and_files_but_close_is_idempotent() {
    let client = Client::default();
    assert!(client
        .command(Command::Close {
            id: "ssh-missing".into()
        })
        .await
        .is_ok());
    assert!(matches!(
        client
            .command(Command::Write {
                id: "ssh-missing".into(),
                data: "x".into()
            })
            .await,
        Err(Error::Closed)
    ));
    assert!(matches!(
        client
            .files("ssh-missing", FileAction::List { path: ".".into() })
            .await,
        Err(Error::Closed)
    ));
}
