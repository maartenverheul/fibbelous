use crate::id::generate_hex_id;
use crate::indexing;
use crate::pages::{save_page, Page, PageWithContent, TOCItem};
// use crate::time::now_rfc3339_seconds; // not needed here currently
use crate::workspaces::{self, CreateWorkspaceRequest, WorkspaceConnection, WorkspaceInfo};
use chrono::Utc;
use sea_orm::DatabaseConnection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Generic command enum modeling current Tauri commands.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "camelCase")]
pub enum Command {
    #[serde(alias = "get_saved_connections")]
    GetSavedConnections,
    #[serde(alias = "get_saved_workspaces")]
    GetSavedWorkspaces,
    Ping,
    #[serde(alias = "add_local_repository")]
    AddLocalRepository {
        existing: bool,
        path: Option<std::path::PathBuf>,
    },
    #[serde(alias = "open_workspace_in_system")]
    OpenWorkspaceInSystem {
        id: String,
    },
    #[serde(alias = "get_toc")]
    GetToc {
        parent: Option<String>,
    },
    #[serde(alias = "remove_workspace")]
    RemoveWorkspace {
        id: String,
    },
    #[serde(alias = "create_new_page")]
    CreateNewPage {
        parent: Option<String>,
    },
    #[serde(alias = "read_page")]
    ReadPage {
        workspace_id: String,
        page_id: String,
    },
    #[serde(alias = "save_remote_workspaces")]
    SaveRemoteWorkspaces {
        urls: Vec<String>,
    },
    #[serde(alias = "create_workspace")]
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

/// Single standardized environment for command execution.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandEnv {
    pub workspaces: Vec<WorkspaceInfo>,
    pub connections: Vec<WorkspaceConnection>,
    #[serde(skip)]
    pub workspace_path: Option<std::path::PathBuf>,
    #[serde(skip)]
    pub active_workspace_id: Option<String>,
    #[serde(skip)]
    pub workspace_dbs: HashMap<String, DatabaseConnection>,
}

impl CommandEnv {
    pub fn new(workspaces: Vec<WorkspaceInfo>, connections: Vec<WorkspaceConnection>) -> Self {
        Self {
            workspaces,
            connections,
            workspace_path: None,
            active_workspace_id: None,
            workspace_dbs: HashMap::new(),
        }
    }

    pub fn with_workspace_path(mut self, path: Option<std::path::PathBuf>) -> Self {
        self.workspace_path = path;
        self
    }
}

impl CommandEnv {
    pub fn set_active_workspace(&mut self, wid: &str) {
        if self.workspace_dbs.contains_key(wid) {
            self.active_workspace_id = Some(wid.to_string());
        }
    }

    pub fn get_db(&self) -> Option<&DatabaseConnection> {
        if let Some(id) = &self.active_workspace_id {
            return self.workspace_dbs.get(id);
        }
        // fallback to first available db
        self.workspace_dbs.values().next()
    }
}

/// Execute a command in the provided environment. Only a subset is currently supported.
pub async fn execute(cmd: Command, env: &CommandEnv) -> CommandResult {
    use Command::*;
    match cmd {
        GetSavedConnections => CommandResult::Connections(ConnectionsPayload {
            connections: env.connections.clone(),
        }),
        GetSavedWorkspaces => CommandResult::Workspaces(WorkspacesPayload {
            workspaces: env.workspaces.clone(),
        }),
        Ping => CommandResult::Pong,
        AddLocalRepository { .. } => CommandResult::Error(ErrorPayload {
            message: "AddLocalRepository not supported".into(),
        }),
        OpenWorkspaceInSystem { .. } => CommandResult::Error(ErrorPayload {
            message: "OpenWorkspaceInSystem not supported".into(),
        }),
        GetToc { parent: _ } => {
            let db = env
                .get_db()
                .expect("Invariant violated: no workspace DB available");
            let list = indexing::list_children(db, None).await.unwrap_or_default();
            let toc_items: Vec<TOCItem> = list
                .into_iter()
                .map(|page| TOCItem {
                    id: page.id,
                    title: page.title.clone(),
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
            // Use first workspace in env (ws layer constrains to a single one per connection)
            if env.workspaces.is_empty() {
                return CommandResult::Error(ErrorPayload {
                    message: "No workspace in environment".into(),
                });
            }
            let page = Page::default(parent);
            if let Some(path) = &env.workspace_path {
                if let Err(e) = save_page(path, &page) {
                    return CommandResult::Error(ErrorPayload {
                        message: format!("Failed to save page: {}", e),
                    });
                }
            } else {
                return CommandResult::Error(ErrorPayload {
                    message: "Workspace path unavailable".into(),
                });
            }
            CommandResult::Page(page)
        }
        ReadPage { .. } => CommandResult::Error(ErrorPayload {
            message: "ReadPage not supported".into(),
        }),
        SaveRemoteWorkspaces { .. } => CommandResult::Error(ErrorPayload {
            message: "SaveRemoteWorkspaces not supported".into(),
        }),
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
