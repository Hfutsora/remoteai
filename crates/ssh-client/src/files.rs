use crate::types::*;
use base64::{engine::general_purpose::STANDARD, Engine};
use russh_sftp::{client::SftpSession, protocol::OpenFlags};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

const MAX_ENTRIES: usize = 5000;

pub(crate) fn validate_path(path: &str) -> Result<()> {
    if path.is_empty() || path.len() > 4096 || path.chars().any(char::is_control) {
        return Err(Error::Invalid);
    }
    Ok(())
}

pub(crate) async fn perform(sftp: &SftpSession, action: FileAction) -> Result<FileReply> {
    let path = match &action {
        FileAction::List { path }
        | FileAction::Read { path }
        | FileAction::Upload { path, .. }
        | FileAction::CreateFolder { path }
        | FileAction::Rename { path, .. }
        | FileAction::Delete { path } => path,
    };
    validate_path(path)?;
    match action {
        FileAction::List { path } => list(sftp, &path).await,
        FileAction::Read { path } => read(sftp, &path).await,
        FileAction::Upload { path, data } => upload(sftp, &path, &data).await,
        FileAction::CreateFolder { path } => {
            sftp.create_dir(path).await.map_err(|_| Error::File)?;
            Ok(FileReply::Done)
        }
        FileAction::Rename { path, destination } => {
            validate_path(&destination)?;
            if sftp.symlink_metadata(&destination).await.is_ok() {
                return Err(Error::Conflict);
            }
            sftp.rename(path, destination)
                .await
                .map_err(|_| Error::File)?;
            Ok(FileReply::Done)
        }
        FileAction::Delete { path } => {
            let meta = sftp
                .symlink_metadata(&path)
                .await
                .map_err(|_| Error::File)?;
            if meta.is_dir() {
                sftp.remove_dir(path).await
            } else {
                sftp.remove_file(path).await
            }
            .map_err(|_| Error::File)?;
            Ok(FileReply::Done)
        }
    }
}

async fn list(sftp: &SftpSession, path: &str) -> Result<FileReply> {
    let path = sftp.canonicalize(path).await.map_err(|_| Error::File)?;
    let mut entries = Vec::new();
    let mut truncated = false;
    for entry in sftp.read_dir(&path).await.map_err(|_| Error::File)? {
        let name = entry.file_name();
        if name == "." || name == ".." || name.contains('/') {
            continue;
        }
        if entries.len() == MAX_ENTRIES {
            truncated = true;
            break;
        }
        let target = format!("{}/{}", path.trim_end_matches('/'), name);
        let metadata = entry.metadata();
        let directory = if metadata.is_symlink() {
            sftp.metadata(&target)
                .await
                .is_ok_and(|metadata| metadata.is_dir())
        } else {
            metadata.is_dir()
        };
        entries.push(Entry {
            name,
            path: target,
            directory,
            size: metadata.size.unwrap_or(0),
        });
    }
    entries.sort_by(|a, b| {
        b.directory
            .cmp(&a.directory)
            .then_with(|| a.name.cmp(&b.name))
    });
    Ok(FileReply::List {
        path,
        entries,
        truncated,
    })
}

async fn read(sftp: &SftpSession, path: &str) -> Result<FileReply> {
    let file = sftp.open(path).await.map_err(|_| Error::File)?;
    if file
        .metadata()
        .await
        .map_err(|_| Error::File)?
        .size
        .unwrap_or(0)
        > MAX_FILE_BYTES as u64
    {
        return Err(Error::FileTooLarge);
    }
    let mut data = Vec::new();
    file.take(MAX_FILE_BYTES as u64 + 1)
        .read_to_end(&mut data)
        .await
        .map_err(|_| Error::File)?;
    if data.len() > MAX_FILE_BYTES {
        return Err(Error::FileTooLarge);
    }
    Ok(FileReply::File {
        data: STANDARD.encode(data),
    })
}

async fn upload(sftp: &SftpSession, path: &str, data: &str) -> Result<FileReply> {
    if data.len() > MAX_FILE_BYTES.div_ceil(3) * 4 {
        return Err(Error::FileTooLarge);
    }
    let data = STANDARD.decode(data).map_err(|_| Error::Invalid)?;
    if data.len() > MAX_FILE_BYTES {
        return Err(Error::FileTooLarge);
    }
    if sftp.symlink_metadata(path).await.is_ok() {
        return Err(Error::Conflict);
    }
    let (parent, _) = path.rsplit_once('/').ok_or(Error::Invalid)?;
    let temporary = format!("{parent}/.remoteai-upload-{}", uuid::Uuid::new_v4());
    let mut file = sftp
        .open_with_flags(
            &temporary,
            OpenFlags::CREATE | OpenFlags::EXCLUDE | OpenFlags::WRITE,
        )
        .await
        .map_err(|_| Error::File)?;
    let result = async {
        file.write_all(&data).await.map_err(|_| Error::File)?;
        file.shutdown().await.map_err(|_| Error::File)?;
        // SFTP v3 rename refuses an existing target, including a file created during this upload.
        sftp.rename(&temporary, path)
            .await
            .map_err(|_| Error::Conflict)?;
        Ok(FileReply::Done)
    }
    .await;
    if result.is_err() {
        if let Err(error) = sftp.remove_file(&temporary).await {
            eprintln!("SSH temporary upload cleanup failed: {error}");
        }
    }
    result
}
