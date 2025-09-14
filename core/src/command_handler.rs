use crate::id::generate_hex_id;
use crate::pages::{Page, PageWithContent, TOCItem};
use crate::state::AppState;
use crate::{indexing, pages};
// use crate::time::now_rfc3339_seconds; // not needed here currently
use crate::workspaces::{
    self, CreateWorkspaceRequest, LoadedWorkspace, WorkspaceConnection, WorkspaceInfo,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
// No direct RwLock usage needed here; AppState encapsulates synchronization.

/// Generic command enum modeling current Tauri commands.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "camelCase")]
pub enum Command {
    #[serde(alias = "get_saved_workspaces", rename_all = "camelCase")]
    GetSavedWorkspaces,
    Ping,
    #[serde(alias = "add_local_repository", rename_all = "camelCase")]
    AddLocalRepository {
        existing: bool,
        path: Option<std::path::PathBuf>,
    },
    #[serde(alias = "open_workspace_in_system", rename_all = "camelCase")]
    OpenWorkspaceInSystem {
        id: String,
    },
    #[serde(alias = "get_toc", rename_all = "camelCase")]
    GetToc {
        parent: Option<String>,
    },
    #[serde(alias = "remove_workspace", rename_all = "camelCase")]
    RemoveWorkspace {
        id: String,
    },
    #[serde(alias = "create_new_page", rename_all = "camelCase")]
    CreateNewPage {
        parent: Option<String>,
    },
    #[serde(alias = "read_page", rename_all = "camelCase")]
    ReadPage {
        page_id: String,
    },
    #[serde(alias = "save_remote_workspaces", rename_all = "camelCase")]
    SaveRemoteWorkspaces {
        urls: Vec<String>,
    },
    #[serde(alias = "create_workspace", rename_all = "camelCase")]
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
    app: AppState,
    workspace: Arc<LoadedWorkspace>,
}

impl CommandHandler {
    pub fn new(app: AppState, workspace: Arc<LoadedWorkspace>) -> Self {
        Self { app, workspace }
    }
    /// Execute a command in the provided environment. Only a subset is currently supported.
    pub async fn execute(&self, cmd: Command) -> CommandResult {
        use Command::*;
        match cmd {
            GetSavedWorkspaces => {
                let guard = self.app.workspaces.read().await;
                let list: Vec<WorkspaceInfo> = guard.values().map(|ws| ws.info.clone()).collect();
                CommandResult::Workspaces(WorkspacesPayload { workspaces: list })
            }
            Ping => CommandResult::Pong,
            AddLocalRepository { .. } => CommandResult::Error(ErrorPayload {
                message: "AddLocalRepository not supported".into(),
            }),
            OpenWorkspaceInSystem { .. } => CommandResult::Error(ErrorPayload {
                message: "OpenWorkspaceInSystem not supported".into(),
            }),
            GetToc { parent: _ } => {
                let db = &self.workspace.db;
                let list = indexing::list_children(db, None).await.unwrap_or_default();
                let toc_items: Vec<TOCItem> = list
                    .into_iter()
                    .map(|page| TOCItem {
                        id: page.id.clone(),
                        title: page.title.clone(),
                        url: pages::get_page_url(&self.workspace.info, &page),
                        slug: page.slug,
                        icon: page.icon,
                        children: Vec::new(),
                    })
                    .collect();
                CommandResult::Toc(TocPayload { toc: toc_items })
            }
            RemoveWorkspace { .. } => CommandResult::Error(ErrorPayload {
                message: "RemoveWorkspace not supported".into(),
            }),
            CreateNewPage { parent } => {
                let page = Page::default(parent);
                if let Err(e) = pages::save_page(&self.workspace.path, &page) {
                    return CommandResult::Error(ErrorPayload {
                        message: format!("Failed to save page: {}", e),
                    });
                }
                CommandResult::Page(page)
            }
            ReadPage { page_id } => match pages::read_page(&self.workspace.connection, &page_id) {
                Ok(pwc) => CommandResult::PageWithContent(pwc),
                Err(e) => CommandResult::Error(ErrorPayload { message: e }),
            },
            SaveRemoteWorkspaces { .. } => CommandResult::Error(ErrorPayload {
                message: "SaveRemoteWorkspaces not supported".into(),
            }),
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
                match workspaces::create(&info, None).await {
                    Ok(state) => {
                        let mut guard = self.app.workspaces.write().await;
                        guard.insert(state.id.clone(), Arc::new(state.clone()));
                        CommandResult::CreateWorkspace(AddLocalRepoResult {
                            ok: true,
                            error: None,
                            workspace: Some(info),
                        })
                    }
                    Err(e) => CommandResult::CreateWorkspace(AddLocalRepoResult {
                        ok: false,
                        error: Some(e.to_string()),
                        workspace: None,
                    }),
                }
            }
        }
    }
}
