use std::path::{Path, PathBuf};

use chrono::Local;
use git2::{
    build::RepoBuilder, Commit, Cred, CredentialType, IndexAddOption, PushOptions,
    RemoteCallbacks, Repository, Signature, Status, StatusOptions,
};
use serde::Serialize;

use crate::cache::ensure_workspace_gitignore;

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
            let commit = head
                .peel_to_commit()
                .map_err(|error| error.to_string())?;
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
    let repo = open_repo(path)?;
    let title = today_commit_title();
    let sig = signature()?;

    stage_all(&repo)?;
    let tree_oid = write_tree_oid(&repo)?;
    let tree = repo.find_tree(tree_oid).map_err(|error| error.to_string())?;

    match head_commit(&repo)? {
        None => {
            repo.commit(Some("HEAD"), &sig, &sig, &title, &tree, &[])
                .map_err(|error| format!("failed to create commit: {error}"))?;
        }
        Some(head) => {
            if head.tree_id() == tree_oid {
                // Nothing changed on disk relative to HEAD.
                return status(path);
            }
            let head_message = head.message().unwrap_or("").trim();
            if head_message == title {
                // Amend: libgit2 refuses commit(Some("HEAD"), …) unless the first
                // parent is the current tip, so create the commit then move the ref.
                let parents: Vec<_> = head.parents().collect();
                let parent_refs: Vec<&Commit> = parents.iter().collect();
                let oid = repo
                    .commit(None, &sig, &sig, &title, &tree, &parent_refs)
                    .map_err(|error| format!("failed to amend commit: {error}"))?;
                set_head_to(&repo, oid, &format!("amend: {title}"))
                    .map_err(|error| format!("failed to amend commit: {error}"))?;
            } else {
                repo.commit(Some("HEAD"), &sig, &sig, &title, &tree, &[&head])
                    .map_err(|error| format!("failed to create commit: {error}"))?;
            }
        }
    }

    status(path)
}

pub fn clone_repo(url: &str, dest: &Path) -> Result<(), String> {
    if dest.exists() {
        return Err(format!(
            "destination already exists: {}",
            dest.to_string_lossy()
        ));
    }

    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let callbacks = remote_callbacks();
    let mut fetch_options = git2::FetchOptions::new();
    fetch_options.remote_callbacks(callbacks);

    RepoBuilder::new()
        .fetch_options(fetch_options)
        .clone(url, dest)
        .map_err(|error| format!("git clone failed: {error}"))?;

    ensure_workspace_gitignore(dest).map_err(|error| error.to_string())?;
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

fn ahead_behind(repo: &Repository) -> Result<(Option<String>, usize, usize, Option<git2::Oid>), String> {
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

    let upstream_name = upstream
        .name()
        .ok()
        .flatten()
        .map(|name| name.to_owned());
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
    let Ok(head_commit) = repo.find_commit(head) else {
        return false;
    };
    let Ok(up_commit) = repo.find_commit(upstream) else {
        return false;
    };
    if head_commit.parent_count() != 1 || up_commit.parent_count() != 1 {
        return false;
    }
    match (head_commit.parent_id(0), up_commit.parent_id(0)) {
        (Ok(a), Ok(b)) => a == b && head != upstream,
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

pub fn push(path: &Path) -> Result<GitStatus, String> {
    let repo = open_repo(path)?;
    let branch = branch_name(&repo)?;
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

    let refspec = if use_force {
        format!("+refs/heads/{branch}:refs/heads/{remote_branch}")
    } else {
        format!("refs/heads/{branch}:refs/heads/{remote_branch}")
    };

    let mut remote = repo
        .find_remote(&remote_name)
        .map_err(|error| error.to_string())?;

    let callbacks = remote_callbacks();
    let mut options = PushOptions::new();
    options.remote_callbacks(callbacks);

    remote
        .push(&[refspec.as_str()], Some(&mut options))
        .map_err(|error| format!("git push failed: {error}"))?;

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
