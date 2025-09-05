use crate::pages::{Page, PageWithContent};
use crate::workspaces::{WorkspaceConnection, WorkspaceInfo};
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
pub fn execute(cmd: Command, env: &CommandEnv) -> CommandResult {
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
    }
}
