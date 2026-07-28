use std::path::{Path, PathBuf};

use chrono::Local;
use git2::{
    build::RepoBuilder, Commit, Cred, CredentialType, IndexAddOption, PushOptions, RemoteCallbacks,
    Repository, Signature, Status, StatusOptions,
};
use serde::Serialize;

use crate::cache::ensure_workspace_gitignore;
use crate::data::log_path;

const COMMIT_NAME: &str = "Fibbelous";
const COMMIT_EMAIL: &str = "fibbelous@local";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum FileChangeStatus {
    Added,
    Modified,
    Deleted,
    Untracked,
    Renamed,
    Typechange,
    Conflicted,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitFileChange {
    pub path: String,
    pub status: FileChangeStatus,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRemote {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub branch: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub upstream: Option<String>,
    pub ahead: usize,
    pub behind: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub head_message: Option<String>,
    pub commit_title: String,
    pub files: Vec<GitFileChange>,
    pub remotes: Vec<GitRemote>,
    pub has_upstream: bool,
    pub can_push: bool,
}

fn today_commit_title() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

fn signature() -> Result<Signature<'static>, String> {
    Signature::now(COMMIT_NAME, COMMIT_EMAIL).map_err(|error| error.to_string())
}

fn credentials_callback(
    url: &str,
    username_from_url: Option<&str>,
    allowed_types: CredentialType,
) -> Result<Cred, git2::Error> {
    if allowed_types.contains(CredentialType::SSH_KEY) {
        let username = username_from_url.unwrap_or("git");
        if let Ok(cred) = Cred::ssh_key_from_agent(username) {
            return Ok(cred);
        }
    }

    if allowed_types.contains(CredentialType::USER_PASS_PLAINTEXT)
        || allowed_types.contains(CredentialType::DEFAULT)
    {
        if let Ok(config) = git2::Config::open_default() {
            if let Ok(cred) = Cred::credential_helper(&config, url, username_from_url) {
                return Ok(cred);
            }
        }
    }

    if allowed_types.contains(CredentialType::DEFAULT) {
        return Cred::default();
    }

    Err(git2::Error::from_str(
        "no system credentials available for this remote",
    ))
}

fn remote_callbacks() -> RemoteCallbacks<'static> {
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(|url, username_from_url, allowed_types| {
        credentials_callback(url, username_from_url, allowed_types)
    });
    callbacks
}

/// True for filesystem remotes (absolute/relative paths), including Windows
/// drive paths that libgit2 would otherwise treat as a URL scheme (`D:`).
fn is_local_path_remote(url: &str) -> bool {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return false;
    }
    if trimmed.starts_with("file://") {
        return true;
    }
    if trimmed.contains("://") {
        return false;
    }
    // scp-like SSH: git@host:path (not a Windows drive)
    if trimmed.contains('@') {
        return false;
    }
    // Windows drive: C:\... or C:/...
    let bytes = trimmed.as_bytes();
    if bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' {
        return true;
    }
    // UNC or unix absolute / relative filesystem path
    trimmed.starts_with("\\\\")
        || trimmed.starts_with("//")
        || trimmed.starts_with('/')
        || trimmed.starts_with('.')
        || trimmed.contains('\\')
        || Path::new(trimmed).is_absolute()
}

fn path_to_file_url(path: &Path) -> String {
    let abs = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let mut normalized = abs.to_string_lossy().replace('\\', "/");
    // Strip Windows verbatim prefix from canonicalize: //?/C:/...
    if let Some(rest) = normalized.strip_prefix("//?/") {
        normalized = rest.to_owned();
    }
    if normalized.starts_with('/') {
        format!("file://{normalized}")
    } else {
        format!("file:///{normalized}")
    }
}

/// Convert local folder remotes to `file://` URLs so libgit2 does not treat
/// Windows drive letters (e.g. `D:`) as an unsupported protocol.
fn normalize_remote_url(url: &str, base: Option<&Path>) -> String {
    let trimmed = url.trim();
    if trimmed.starts_with("file://") || !is_local_path_remote(trimmed) {
        return trimmed.to_owned();
    }

    let path = PathBuf::from(trimmed);
    let resolved = if path.is_absolute() {
        path
    } else if let Some(base) = base {
        base.join(path)
    } else {
        std::env::current_dir()
            .map(|cwd| cwd.join(path))
            .unwrap_or_else(|_| PathBuf::from(trimmed))
    };
    path_to_file_url(&resolved)
}

fn repo_path_base(repo: &Repository) -> PathBuf {
    repo.workdir()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| repo.path().to_path_buf())
}

pub fn is_git_repo(path: &Path) -> bool {
    Repository::open(path).is_ok()
}

pub fn init_repo(path: &Path) -> Result<(), String> {
    ensure_workspace_gitignore(path).map_err(|error| error.to_string())?;
    if is_git_repo(path) {
        return Ok(());
    }
    Repository::init(path).map_err(|error| error.to_string())?;
    Ok(())
}

fn open_repo(path: &Path) -> Result<Repository, String> {
    Repository::open(path).map_err(|error| format!("failed to open git repository: {error}"))
}

fn head_commit(repo: &Repository) -> Result<Option<Commit<'_>>, String> {
    match repo.head() {
        Ok(head) => {
            let commit = head.peel_to_commit().map_err(|error| error.to_string())?;
            Ok(Some(commit))
        }
        Err(error) if error.code() == git2::ErrorCode::UnbornBranch => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

fn stage_all(repo: &Repository) -> Result<(), String> {
    let mut index = repo.index().map_err(|error| error.to_string())?;
    // Match `git add -A`: update tracked paths (incl. deletions), then add untracked.
    index
        .update_all(["*"].iter(), None)
        .map_err(|error| format!("failed to update index: {error}"))?;
    index
        .add_all(["*"].iter(), IndexAddOption::DEFAULT, None)
        .map_err(|error| format!("failed to stage changes: {error}"))?;
    index
        .write()
        .map_err(|error| format!("failed to write index: {error}"))?;
    Ok(())
}

fn write_tree_oid(repo: &Repository) -> Result<git2::Oid, String> {
    let mut index = repo.index().map_err(|error| error.to_string())?;
    index.write_tree().map_err(|error| error.to_string())
}

/// Move the current branch (or detached HEAD) to `oid`.
fn set_head_to(repo: &Repository, oid: git2::Oid, log_message: &str) -> Result<(), String> {
    let head = repo.head().map_err(|error| error.to_string())?;
    if let Some(target) = head.symbolic_target() {
        let target = target.to_owned();
        let mut reference = repo
            .find_reference(&target)
            .map_err(|error| error.to_string())?;
        reference
            .set_target(oid, log_message)
            .map_err(|error| error.to_string())?;
    } else {
        let mut reference = head;
        reference
            .set_target(oid, log_message)
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

/// Stage all changes and create or amend today's `yyyy-mm-dd` commit.
pub fn commit_daily(path: &Path) -> Result<GitStatus, String> {
    let title = today_commit_title();
    tracing::info!(path = %log_path(path), %title, "git commit_daily starting");

    let repo = open_repo(path)?;
    let sig = signature()?;

    stage_all(&repo)?;
    let tree_oid = write_tree_oid(&repo)?;
    let tree = repo
        .find_tree(tree_oid)
        .map_err(|error| error.to_string())?;

    match head_commit(&repo)? {
        None => {
            tracing::info!(path = %log_path(path), %title, "creating initial daily commit");
            repo.commit(Some("HEAD"), &sig, &sig, &title, &tree, &[])
                .map_err(|error| format!("failed to create commit: {error}"))?;
        }
        Some(head) => {
            if head.tree_id() == tree_oid {
                // Nothing changed on disk relative to HEAD.
                tracing::info!(path = %log_path(path), %title, "git commit_daily skipped (no changes)");
                return status(path);
            }
            let head_message = head.message().unwrap_or("").trim();
            if head_message == title {
                // Amend: libgit2 refuses commit(Some("HEAD"), …) unless the first
                // parent is the current tip, so create the commit then move the ref.
                tracing::info!(path = %log_path(path), %title, "amending daily commit");
                let parents: Vec<_> = head.parents().collect();
                let parent_refs: Vec<&Commit> = parents.iter().collect();
                let oid = repo
                    .commit(None, &sig, &sig, &title, &tree, &parent_refs)
                    .map_err(|error| format!("failed to amend commit: {error}"))?;
                set_head_to(&repo, oid, &format!("amend: {title}"))
                    .map_err(|error| format!("failed to amend commit: {error}"))?;
            } else {
                tracing::info!(path = %log_path(path), %title, "creating new daily commit");
                repo.commit(Some("HEAD"), &sig, &sig, &title, &tree, &[&head])
                    .map_err(|error| format!("failed to create commit: {error}"))?;
            }
        }
    }

    tracing::info!(path = %log_path(path), %title, "git commit_daily finished");
    status(path)
}

pub fn clone_repo(url: &str, dest: &Path) -> Result<(), String> {
    tracing::info!(%url, dest = %log_path(dest), "git clone starting");

    if dest.exists() {
        return Err(format!(
            "destination already exists: {}",
            dest.to_string_lossy()
        ));
    }

    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let clone_url = normalize_remote_url(url, None);
    let callbacks = remote_callbacks();
    let mut fetch_options = git2::FetchOptions::new();
    fetch_options.remote_callbacks(callbacks);

    RepoBuilder::new()
        .fetch_options(fetch_options)
        .clone(&clone_url, dest)
        .map_err(|error| format!("git clone failed: {error}"))?;

    ensure_workspace_gitignore(dest).map_err(|error| error.to_string())?;
    tracing::info!(%url, dest = %log_path(dest), "git clone finished");
    Ok(())
}

fn branch_name(repo: &Repository) -> Result<String, String> {
    let head = match repo.head() {
        Ok(head) => head,
        Err(error) if error.code() == git2::ErrorCode::UnbornBranch => {
            return Ok("main".to_owned());
        }
        Err(error) => return Err(error.to_string()),
    };
    if head.is_branch() {
        return Ok(head.shorthand().unwrap_or("HEAD").to_owned());
    }
    Ok("HEAD".to_owned())
}

fn ahead_behind(
    repo: &Repository,
) -> Result<(Option<String>, usize, usize, Option<git2::Oid>), String> {
    let Ok(head) = repo.head() else {
        return Ok((None, 0, 0, None));
    };
    let Some(local_oid) = head.target() else {
        return Ok((None, 0, 0, None));
    };

    let branch = match branch_name(repo) {
        Ok(name) => name,
        Err(_) => return Ok((None, 0, 0, None)),
    };

    let Ok(local_branch) = repo.find_branch(&branch, git2::BranchType::Local) else {
        return Ok((None, 0, 0, None));
    };

    let upstream = match local_branch.upstream() {
        Ok(upstream) => upstream,
        Err(_) => return Ok((None, 0, 0, None)),
    };

    let upstream_name = upstream.name().ok().flatten().map(|name| name.to_owned());
    let Some(upstream_oid) = upstream.get().target() else {
        return Ok((upstream_name, 0, 0, None));
    };

    let (ahead, behind) = repo
        .graph_ahead_behind(local_oid, upstream_oid)
        .map_err(|error| error.to_string())?;
    Ok((upstream_name, ahead, behind, Some(upstream_oid)))
}

fn map_status(status: Status) -> Option<FileChangeStatus> {
    if status.contains(Status::CONFLICTED) {
        return Some(FileChangeStatus::Conflicted);
    }
    if status.contains(Status::WT_DELETED) || status.contains(Status::INDEX_DELETED) {
        return Some(FileChangeStatus::Deleted);
    }
    if status.contains(Status::WT_RENAMED) || status.contains(Status::INDEX_RENAMED) {
        return Some(FileChangeStatus::Renamed);
    }
    if status.contains(Status::WT_TYPECHANGE) || status.contains(Status::INDEX_TYPECHANGE) {
        return Some(FileChangeStatus::Typechange);
    }
    if status.contains(Status::WT_NEW) && !status.contains(Status::INDEX_NEW) {
        return Some(FileChangeStatus::Untracked);
    }
    if status.contains(Status::INDEX_NEW) {
        return Some(FileChangeStatus::Added);
    }
    if status.contains(Status::WT_MODIFIED) || status.contains(Status::INDEX_MODIFIED) {
        return Some(FileChangeStatus::Modified);
    }
    None
}

fn collect_files(repo: &Repository) -> Result<Vec<GitFileChange>, String> {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_unmodified(false)
        .exclude_submodules(true)
        .show(git2::StatusShow::IndexAndWorkdir);

    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|error| error.to_string())?;
    let mut files = Vec::new();

    for entry in statuses.iter() {
        let Some(path) = entry.path() else {
            continue;
        };
        let Some(status) = map_status(entry.status()) else {
            continue;
        };
        files.push(GitFileChange {
            path: path.replace('\\', "/"),
            status,
        });
    }

    files.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(files)
}

fn is_amend_rewrite(repo: &Repository, head: git2::Oid, upstream: git2::Oid) -> bool {
    if head == upstream {
        return false;
    }
    let Ok(head_commit) = repo.find_commit(head) else {
        return false;
    };
    let Ok(up_commit) = repo.find_commit(upstream) else {
        return false;
    };
    let head_parents = head_commit.parent_count();
    let up_parents = up_commit.parent_count();
    if head_parents != up_parents {
        return false;
    }
    // Amended initial (root) commit: both have no parents, different OIDs.
    if head_parents == 0 {
        return true;
    }
    if head_parents != 1 {
        return false;
    }
    match (head_commit.parent_id(0), up_commit.parent_id(0)) {
        (Ok(a), Ok(b)) => a == b,
        _ => false,
    }
}

fn collect_remotes(repo: &Repository) -> Result<Vec<GitRemote>, String> {
    let names = repo.remotes().map_err(|error| error.to_string())?;
    let mut remotes = Vec::new();
    for name in names.iter().flatten() {
        let remote = repo.find_remote(name).map_err(|error| error.to_string())?;
        let url = remote
            .url()
            .or_else(|| remote.pushurl())
            .unwrap_or("")
            .to_owned();
        remotes.push(GitRemote {
            name: name.to_owned(),
            url,
        });
    }
    remotes.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(remotes)
}

pub fn status(path: &Path) -> Result<GitStatus, String> {
    let repo = open_repo(path)?;
    let commit_title = today_commit_title();

    let (branch, head_message, head_oid) = match head_commit(&repo)? {
        Some(commit) => {
            let oid = commit.id();
            let branch = branch_name(&repo).unwrap_or_else(|_| "HEAD".to_owned());
            let message = commit.message().map(|m| m.trim().to_owned());
            (branch, message, Some(oid))
        }
        None => ("main".to_owned(), None, None),
    };

    let (upstream, ahead, behind, upstream_oid) = ahead_behind(&repo)?;
    let files = collect_files(&repo)?;
    let remotes = collect_remotes(&repo)?;
    let has_upstream = upstream.is_some();

    let can_push = match (head_oid, upstream_oid) {
        (Some(_head), Some(_up)) if ahead > 0 && behind == 0 => true,
        (Some(head), Some(up)) if ahead > 0 && is_amend_rewrite(&repo, head, up) => true,
        _ => false,
    };

    Ok(GitStatus {
        branch,
        upstream,
        ahead,
        behind,
        head_message,
        commit_title,
        files,
        remotes,
        has_upstream,
        can_push,
    })
}

fn resolve_upstream(
    repo: &Repository,
) -> Result<(String, String, String, git2::Branch<'_>), String> {
    let branch = branch_name(repo)?;
    let local = repo
        .find_branch(&branch, git2::BranchType::Local)
        .map_err(|_| format!("branch '{branch}' not found"))?;

    let upstream = local
        .upstream()
        .map_err(|_| "no upstream configured for the current branch".to_owned())?;
    let upstream_name = upstream
        .name()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "upstream has no name".to_owned())?
        .to_owned();

    let remote_name = upstream_name
        .split('/')
        .next()
        .ok_or_else(|| "invalid upstream name".to_owned())?
        .to_owned();
    let remote_branch = upstream_name
        .strip_prefix(&format!("{remote_name}/"))
        .unwrap_or(&branch)
        .to_owned();

    Ok((branch, remote_name, remote_branch, upstream))
}

fn fetch_remote_branch(
    repo: &Repository,
    remote_name: &str,
    remote_branch: &str,
) -> Result<(), String> {
    let remote = repo
        .find_remote(remote_name)
        .map_err(|error| error.to_string())?;
    let original_url = remote
        .url()
        .ok_or_else(|| format!("remote '{remote_name}' has no URL"))?
        .to_owned();
    let fetch_url = normalize_remote_url(&original_url, Some(&repo_path_base(repo)));

    tracing::info!(
        remote = %remote_name,
        branch = %remote_branch,
        url = %fetch_url,
        "git fetch starting"
    );

    let mut fetch_opts = git2::FetchOptions::new();
    fetch_opts.remote_callbacks(remote_callbacks());

    if fetch_url == original_url {
        let mut remote = remote;
        remote
            .fetch(&[remote_branch], Some(&mut fetch_opts), None)
            .map_err(|error| format!("git fetch failed: {error} (remote: {fetch_url})"))?;
    } else {
        // Local folder remotes (esp. Windows `D:\...`) must use file:// for libgit2.
        // Anonymous remote + explicit refspec updates the named remote-tracking branch.
        let mut anon = repo
            .remote_anonymous(&fetch_url)
            .map_err(|error| format!("failed to open local remote: {error}"))?;
        let refspec =
            format!("+refs/heads/{remote_branch}:refs/remotes/{remote_name}/{remote_branch}");
        anon.fetch(&[refspec.as_str()], Some(&mut fetch_opts), None)
            .map_err(|error| format!("git fetch failed: {error} (remote: {fetch_url})"))?;
    }

    tracing::info!(
        remote = %remote_name,
        branch = %remote_branch,
        "git fetch finished"
    );
    Ok(())
}

fn fast_forward_to(repo: &Repository, branch: &str, target: git2::Oid) -> Result<(), String> {
    let head_oid = repo
        .head()
        .ok()
        .and_then(|head| head.target())
        .ok_or_else(|| "HEAD has no commit".to_owned())?;

    if head_oid == target {
        return Ok(());
    }

    let is_descendant = repo
        .graph_descendant_of(target, head_oid)
        .map_err(|error| error.to_string())?;
    if !is_descendant {
        return Err("cannot pull: histories have diverged (fast-forward only)".to_owned());
    }

    tracing::info!(
        %branch,
        from = %head_oid,
        to = %target,
        "git fast-forward starting"
    );

    let commit = repo
        .find_commit(target)
        .map_err(|error| error.to_string())?;
    let mut checkout = git2::build::CheckoutBuilder::new();
    checkout.safe();
    repo.checkout_tree(commit.as_object(), Some(&mut checkout))
        .map_err(|error| {
            format!("cannot pull: working tree conflicts with upstream changes ({error})")
        })?;

    let mut local = repo
        .find_branch(branch, git2::BranchType::Local)
        .map_err(|error| error.to_string())?;
    local
        .get_mut()
        .set_target(target, "pull: fast-forward")
        .map_err(|error| format!("failed to fast-forward: {error}"))?;

    tracing::info!(%branch, to = %target, "git fast-forward finished");
    Ok(())
}

pub fn push(path: &Path) -> Result<GitStatus, String> {
    tracing::info!(path = %log_path(path), "git push starting");
    let repo = open_repo(path)?;
    let (branch, remote_name, remote_branch, upstream) = resolve_upstream(&repo)?;

    let head_oid = repo
        .head()
        .ok()
        .and_then(|head| head.target())
        .ok_or_else(|| "HEAD has no commit".to_owned())?;
    let upstream_oid = upstream.get().target();

    let use_force = match upstream_oid {
        Some(up_oid) => is_amend_rewrite(&repo, head_oid, up_oid),
        None => false,
    };

    let (_, ahead, behind, _) = ahead_behind(&repo)?;
    tracing::info!(
        path = %log_path(path),
        %branch,
        remote = %remote_name,
        remote_branch = %remote_branch,
        ahead,
        behind,
        force = use_force,
        "git push resolved upstream"
    );

    if !use_force && !(ahead > 0 && behind == 0) {
        return Err(
            "cannot push: remote has commits we don't have (not a same-day amend)"
                .to_owned(),
        );
    }
    if ahead == 0 && !use_force {
        tracing::info!(path = %log_path(path), %branch, "git push skipped (already up to date)");
        return status(path);
    }

    // Daily amend rewrites the pushed tip; a normal push is non-fast-forward.
    let refspec = if use_force {
        format!("+refs/heads/{branch}:refs/heads/{remote_branch}")
    } else {
        format!("refs/heads/{branch}:refs/heads/{remote_branch}")
    };

    let mut remote = repo
        .find_remote(&remote_name)
        .map_err(|error| error.to_string())?;

    let original_url = remote
        .url()
        .ok_or_else(|| format!("remote '{remote_name}' has no URL"))?
        .to_owned();
    let push_url = normalize_remote_url(&original_url, Some(&repo_path_base(&repo)));

    tracing::info!(
        path = %log_path(path),
        %refspec,
        url = %push_url,
        force = use_force,
        "git push transferring"
    );

    let callbacks = remote_callbacks();
    let mut options = PushOptions::new();
    options.remote_callbacks(callbacks);

    let push_result = if push_url == original_url {
        remote.push(&[refspec.as_str()], Some(&mut options))
    } else {
        // Local folder remotes (esp. Windows `D:\...`) must use file:// for libgit2.
        // Use an anonymous remote so we don't rewrite the user's configured URL.
        let mut anon = repo
            .remote_anonymous(&push_url)
            .map_err(|error| format!("failed to open local remote: {error}"))?;
        anon.push(&[refspec.as_str()], Some(&mut options))
    };

    push_result.map_err(|error| {
        let detail = format!("{error} (remote: {push_url})");
        if use_force {
            format!("git force-push failed: {detail}")
        } else {
            format!("git push failed: {detail}")
        }
    })?;

    // Refresh remote-tracking ref so status no longer shows behind after amend push.
    if push_url == original_url {
        let _ = fetch_remote_branch(&repo, &remote_name, &remote_branch);
    } else {
        let tracking = format!("refs/remotes/{remote_name}/{remote_branch}");
        let _ = repo.reference(&tracking, head_oid, true, "update after local push");
    }

    tracing::info!(path = %log_path(path), %branch, force = use_force, "git push finished");
    status(path)
}

/// Fetch the configured upstream, then fast-forward the current branch if behind.
pub fn pull(path: &Path) -> Result<GitStatus, String> {
    tracing::info!(path = %log_path(path), "git pull starting");
    let repo = open_repo(path)?;
    let (branch, remote_name, remote_branch, _) = resolve_upstream(&repo)?;

    tracing::info!(
        path = %log_path(path),
        %branch,
        remote = %remote_name,
        remote_branch = %remote_branch,
        "git pull resolved upstream"
    );

    fetch_remote_branch(&repo, &remote_name, &remote_branch)?;

    let (_, ahead, behind, upstream_oid) = ahead_behind(&repo)?;
    tracing::info!(
        path = %log_path(path),
        %branch,
        ahead,
        behind,
        "git pull after fetch"
    );

    if behind == 0 {
        tracing::info!(path = %log_path(path), %branch, "git pull skipped (already up to date)");
        return status(path);
    }
    if ahead > 0 {
        return Err(
            "cannot pull: branch has diverged from upstream (fast-forward only)".to_owned(),
        );
    }

    let target = upstream_oid.ok_or_else(|| "upstream has no commit".to_owned())?;
    fast_forward_to(&repo, &branch, target)?;

    tracing::info!(path = %log_path(path), %branch, "git pull finished");
    status(path)
}

/// Suggest a folder name from a git URL.
pub fn folder_name_from_url(url: &str) -> String {
    let trimmed = url.trim().trim_end_matches('/');
    let without_git = trimmed.strip_suffix(".git").unwrap_or(trimmed);
    let name = without_git
        .rsplit(['/', ':'])
        .next()
        .unwrap_or("workspace")
        .trim();
    if name.is_empty() {
        "workspace".to_owned()
    } else {
        name.to_owned()
    }
}

pub fn ensure_repo_with_commit(path: &Path) -> Result<(), String> {
    init_repo(path)?;
    if head_commit(&open_repo(path)?)?.is_none() {
        commit_daily(path)?;
    }
    Ok(())
}

/// Resolve dest path for cloning into a parent directory.
pub fn clone_dest_in_parent(parent: &Path, url: &str) -> PathBuf {
    parent.join(folder_name_from_url(url))
}
