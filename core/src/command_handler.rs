use crate::id::generate_hex_id;
use crate::pages::{Page, PageWithContent, TOCItem};
use crate::state::AppState;
use crate::workspaces::{
    CreateWorkspaceRequest, LoadedWorkspace, WorkspaceConnection, WorkspaceInfo,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Generic command enum modeling current Tauri commands.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "camelCase")]
pub enum Command {
    #[serde(alias = "add_local_repository", rename_all = "camelCase")]
    AddLocalRepository {
        existing: bool,
        path: Option<std::path::PathBuf>,
    },
    #[serde(alias = "create_new_page", rename_all = "camelCase")]
    CreateNewPage {
        parent: Option<String>,
    },
    #[serde(alias = "create_workspace", rename_all = "camelCase")]
    CreateWorkspace {
        request: CreateWorkspaceRequest,
    },
    #[serde(alias = "delete_page", rename_all = "camelCase")]
    DeletePage {
        page_id: String,
    },
    #[serde(alias = "get_saved_workspaces", rename_all = "camelCase")]
    GetSavedWorkspaces,
    #[serde(alias = "get_toc", rename_all = "camelCase")]
    GetToc {
        parent: Option<String>,
    },
    #[serde(alias = "open_workspace_in_system", rename_all = "camelCase")]
    OpenWorkspaceInSystem {
        id: String,
    },
    Ping,
    #[serde(alias = "read_page", rename_all = "camelCase")]
    ReadPage {
        page_id: String,
    },
    #[serde(alias = "remove_workspace", rename_all = "camelCase")]
    RemoveWorkspace {
        id: String,
    },
    #[serde(alias = "save_remote_workspaces", rename_all = "camelCase")]
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
#[serde(tag = "type", content = "payload", rename_all = "camelCase")]
pub enum CommandResult {
    Void,
    Pong,
    // Wrapped payload variants to standardize JSON shape (always { "type": ..., "payload": ... })
    Bool(BoolPayload),
    Connections(ConnectionsPayload),
    Workspaces(WorkspacesPayload),
    Toc(TocPayload),
    AddLocal(AddLocalRepoResult),
    Page(Page),
    PageWithContent(PageWithContent),
    CreateWorkspace(AddLocalRepoResult),
    Error(ErrorPayload),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoolPayload {
    pub value: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionsPayload {
    pub connections: Vec<WorkspaceConnection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacesPayload {
    pub workspaces: Vec<WorkspaceInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TocPayload {
    pub toc: Vec<TOCItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorPayload {
    pub message: String,
}

pub struct CommandHandler {
    pub app: AppState,
    pub workspace: Arc<LoadedWorkspace>,
}

impl CommandHandler {
    pub fn new(app: AppState, workspace: Arc<LoadedWorkspace>) -> Self {
        Self { app, workspace }
    }
    /// Execute a command in the provided environment. Only a subset is currently supported.
    pub async fn execute(&self, cmd: Command) -> CommandResult {
        use Command::*;
        match cmd {
            AddLocalRepository { .. } => CommandResult::Error(ErrorPayload {
                message: "AddLocalRepository not supported".into(),
            }),
            CreateNewPage { parent } => {
                let page = Page::default(parent);
                if let Err(e) = self.workspace.page_manager.save_page(&page).await {
                    return CommandResult::Error(ErrorPayload {
                        message: format!("Failed to save page: {}", e),
                    });
                }
                CommandResult::Page(page)
            }
            CreateWorkspace { request } => {
                let info = WorkspaceInfo {
                    id: generate_hex_id(),
                    slug: request.slug.clone(),
                    title: request.title.clone(),
                    icon: request.icon.clone(),
                    description: request.description.clone(),
                    created_at: Utc::now(),
                    version: 1,
                };
                match self.app.workspace_manager.create(&info, None).await {
                    Ok(_) => CommandResult::CreateWorkspace(AddLocalRepoResult {
                        ok: true,
                        error: None,
                        workspace: Some(info),
                    }),
                    Err(e) => CommandResult::CreateWorkspace(AddLocalRepoResult {
                        ok: false,
                        error: Some(e.to_string()),
                        workspace: None,
                    }),
                }
            }
            DeletePage { page_id } => {
                match self.workspace.page_manager.delete_page(&page_id).await {
                    Ok(_) => CommandResult::Void,
                    Err(e) => CommandResult::Error(ErrorPayload { message: e }),
                }
            }
            GetSavedWorkspaces => {
                let guard = self.app.workspace_manager.workspaces.read().await;
                let list: Vec<WorkspaceInfo> = guard.values().map(|ws| ws.info.clone()).collect();
                CommandResult::Workspaces(WorkspacesPayload { workspaces: list })
            }
            GetToc { parent } => {
                match self
                    .workspace
                    .page_manager
                    .make_toc(parent.as_deref())
                    .await
                {
                    Ok(items) => CommandResult::Toc(TocPayload { toc: items }),
                    Err(_) => CommandResult::Toc(TocPayload { toc: Vec::new() }),
                }
            }
            OpenWorkspaceInSystem { .. } => CommandResult::Error(ErrorPayload {
                message: "OpenWorkspaceInSystem not supported".into(),
            }),
            Ping => CommandResult::Pong,
            RemoveWorkspace { .. } => CommandResult::Error(ErrorPayload {
                message: "RemoveWorkspace not supported".into(),
            }),
            ReadPage { page_id } => match self.workspace.page_manager.read_page(&page_id) {
                Ok(pwc) => CommandResult::PageWithContent(pwc),
                Err(e) => CommandResult::Error(ErrorPayload { message: e }),
            },
            SaveRemoteWorkspaces { .. } => CommandResult::Error(ErrorPayload {
                message: "SaveRemoteWorkspaces not supported".into(),
            }),
        }
    }
}
