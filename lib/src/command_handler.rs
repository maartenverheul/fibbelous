use crate::id::generate_hex_id;
use crate::pages::{Page, PageWithContent};
// use crate::time::now_rfc3339_seconds; // not needed here currently
use crate::workspaces::{self, CreateWorkspaceRequest, WorkspaceConnection, WorkspaceInfo};
use chrono::Utc;
use serde::{Deserialize, Serialize};

/// Generic command enum modeling current Tauri commands.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "camelCase")]
pub enum Command {
    GetSavedConnections,
    GetSavedWorkspaces,
    Ping,
    AddLocalRepository {
        existing: bool,
        path: Option<std::path::PathBuf>,
    },
    OpenWorkspaceInSystem {
        id: String,
    },
    RemoveWorkspace {
        id: String,
    },
    CreateNewPage {
        parent: Option<String>,
    },
    ReadPage {
        workspace_id: String,
        page_id: String,
    },
    SaveRemoteWorkspaces {
        urls: Vec<String>,
    },
    CreateWorkspace {
        request: CreateWorkspaceRequest,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddLocalRepoResult {
    pub ok: bool,
    pub error: Option<String>,
    pub workspace: Option<WorkspaceInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CommandResult {
    Void,
    Bool(bool),
    Connections(Vec<WorkspaceConnection>),
    Workspaces(Vec<WorkspaceInfo>),
    Pong,
    AddLocal(AddLocalRepoResult),
    Page(Page),
    PageWithContent(PageWithContent),
    CreateWorkspace(AddLocalRepoResult),
    Error(String),
}

/// Single standardized environment for command execution.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandEnv {
    pub workspaces: Vec<WorkspaceInfo>,
    pub connections: Vec<WorkspaceConnection>,
}

impl CommandEnv {
    pub fn new(workspaces: Vec<WorkspaceInfo>, connections: Vec<WorkspaceConnection>) -> Self {
        Self {
            workspaces,
            connections,
        }
    }
}

/// Execute a command in the provided environment. Only a subset is currently supported.
pub async fn execute(cmd: Command, env: &CommandEnv) -> CommandResult {
    use Command::*;
    match cmd {
        GetSavedConnections => CommandResult::Connections(env.connections.clone()),
        GetSavedWorkspaces => CommandResult::Workspaces(env.workspaces.clone()),
        Ping => CommandResult::Pong,
        AddLocalRepository { .. } => {
            CommandResult::Error("AddLocalRepository not supported".into())
        }
        OpenWorkspaceInSystem { .. } => {
            CommandResult::Error("OpenWorkspaceInSystem not supported".into())
        }
        RemoveWorkspace { .. } => CommandResult::Error("RemoveWorkspace not supported".into()),
        CreateNewPage { .. } => CommandResult::Error("CreateNewPage not supported".into()),
        ReadPage { .. } => CommandResult::Error("ReadPage not supported".into()),
        SaveRemoteWorkspaces { .. } => {
            CommandResult::Error("SaveRemoteWorkspaces not supported".into())
        }
        CreateWorkspace { request } => {
            let workspace = WorkspaceInfo {
                id: generate_hex_id(),
                slug: request.slug.clone(),
                title: request.title.clone(),
                icon: request.icon.clone(),
                description: request.description.clone(),
                created_at: Utc::now(),
                version: 1,
            };
            let result = workspaces::create(&workspace, None).await;
            // For now, just echo back the info as a successful result
            CommandResult::CreateWorkspace(AddLocalRepoResult {
                ok: result.is_ok(),
                error: result.err().map(|e| e.to_string()),
                workspace: Some(workspace),
            })
        }
    }
}
