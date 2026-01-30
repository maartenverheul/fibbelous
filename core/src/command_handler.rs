use crate::events::{Event, TOCUpdateAction};
use crate::id::generate_hex_id;
use crate::pages::{Page, PageWithContent, TOCItem};
use crate::state::AppState;
use crate::workspaces::{
    CreateWorkspaceRequest, LoadedWorkspace, WorkspaceConnection, WorkspaceInfo,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use slugify::slugify;
use std::sync::Arc;
use Command::*;

/// Generic command enum modeling current Tauri commands.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "camelCase")]
pub enum Command {
    #[serde(rename_all = "camelCase")]
    AddLocalRepository {
        existing: bool,
        path: Option<std::path::PathBuf>,
    },
    #[serde(rename_all = "camelCase")]
    CreateNewPage {
        parent: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    CreateWorkspace {
        request: CreateWorkspaceRequest,
    },
    #[serde(rename_all = "camelCase")]
    DeletePage {
        page_id: String,
    },
    #[serde(rename_all = "camelCase")]
    EditWorkspace {
        workspace: crate::workspaces::WorkspaceInfo,
    },
    #[serde(rename_all = "camelCase")]
    GetSavedWorkspaces,
    #[serde(rename_all = "camelCase")]
    GetWorkspace {
        id: String,
    },
    #[serde(rename_all = "camelCase")]
    GetToc {
        parent: Option<String>,
        depth: Option<i8>,
    },
    #[serde(rename_all = "camelCase")]
    OpenWorkspaceInSystem {
        id: String,
    },
    Ping,
    #[serde(rename_all = "camelCase")]
    ReadPage {
        page_id: String,
    },
    #[serde(rename_all = "camelCase")]
    UpdatePage {
        page_id: String,
        title: Option<String>,
        content: Option<String>,
        icon: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    RemoveWorkspace {
        id: String,
    },
    #[serde(rename_all = "camelCase")]
    SaveRemoteWorkspaces {
        urls: Vec<String>,
    },
    SwitchWorkspace {
        id: String,
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
    Workspace(WorkspaceInfo),
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
    pub app: Arc<AppState>,
    pub workspace: Option<Arc<LoadedWorkspace>>,
}

impl CommandHandler {
    pub fn new(app: Arc<AppState>, workspace: Option<Arc<LoadedWorkspace>>) -> Self {
        Self { app, workspace }
    }
    /// Execute a command in the provided environment. Only a subset is currently supported.
    pub async fn execute(&self, cmd: Command) -> CommandResult {
        match cmd {
            AddLocalRepository { .. } => CommandResult::Error(ErrorPayload {
                message: "AddLocalRepository not supported".into(),
            }),
            CreateNewPage { parent } => {
                let Some(workspace) = &self.workspace else {
                    return CommandResult::Error(ErrorPayload {
                        message: "No active workspace".into(),
                    });
                };
                let page = Page::default(parent);
                if let Err(e) = workspace.page_manager.save_page(&page).await {
                    return CommandResult::Error(ErrorPayload {
                        message: format!("Failed to save page: {}", e),
                    });
                }
                // Broadcast TOC updated event (parent of created page)
                let toc_item = workspace.page_manager.make_toc_item(&page).await;
                let _ = workspace.events_tx.send(Event::TocUpdated {
                    id: page.id.clone(),
                    item: Some(toc_item.clone()),
                    action: TOCUpdateAction::Add,
                });
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
                match self.app.workspaces.create(info, None).await {
                    Ok(loaded_workspace) => CommandResult::CreateWorkspace(AddLocalRepoResult {
                        ok: true,
                        error: None,
                        workspace: Some(loaded_workspace.info),
                    }),
                    Err(e) => CommandResult::CreateWorkspace(AddLocalRepoResult {
                        ok: false,
                        error: Some(e.to_string()),
                        workspace: None,
                    }),
                }
            }
            DeletePage { page_id } => {
                let Some(workspace) = &self.workspace else {
                    return CommandResult::Error(ErrorPayload {
                        message: "No active workspace".into(),
                    });
                };
                match workspace.page_manager.delete_page(&page_id).await {
                    Ok(_) => {
                        let _ = workspace.events_tx.send(Event::TocUpdated {
                            id: page_id,
                            item: None,
                            action: TOCUpdateAction::Remove,
                        });

                        CommandResult::Void
                    }
                    Err(e) => CommandResult::Error(ErrorPayload { message: e }),
                }
            }
            EditWorkspace { workspace } => {
                // Find the workspace by id and update its info
                // let id = workspace.id.clone();
                // if let Some(existing) = self.app.workspaces.list.get_mut(&id) {
                //     let path = existing.path.clone();
                //     // Write new info to disk
                //     if let Err(e) = self.app.workspaces.write_workspace_info(&path, &workspace) {
                //         return CommandResult::Error(ErrorPayload {
                //             message: format!("Failed to write workspace info: {e}"),
                //         });
                //     }
                //     // Update in-memory info only
                //     Arc::get_mut(existing).map(|loaded| loaded.info = workspace.clone());
                //     CommandResult::Workspace(workspace)
                // } else {
                // CommandResult::Error(ErrorPayload {
                //     message: format!("Workspace not found: {id}"),
                // })
                // }
                CommandResult::Error(ErrorPayload {
                    message: format!("Command not implemented"),
                })
            }
            GetSavedWorkspaces => {
                let list_guard = self.app.workspaces.list.read().await;
                let list: Vec<WorkspaceInfo> =
                    list_guard.values().map(|ws| ws.info.clone()).collect();
                CommandResult::Workspaces(WorkspacesPayload { workspaces: list })
            }
            GetWorkspace { id } => {
                // Try fresh reload (ensures file changes are reflected)
                match self.app.workspaces.reload_workspace_info(&id).await {
                    Ok(info) => CommandResult::Workspace(info),
                    Err(e) => CommandResult::Error(ErrorPayload { message: e }),
                }
            }
            GetToc { parent, depth } => {
                let Some(workspace) = &self.workspace else {
                    return CommandResult::Error(ErrorPayload {
                        message: "No active workspace".into(),
                    });
                };
                match workspace
                    .page_manager
                    .make_toc(parent.as_deref(), depth)
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
            ReadPage { page_id } => {
                let Some(workspace) = &self.workspace else {
                    return CommandResult::Error(ErrorPayload {
                        message: "No active workspace".into(),
                    });
                };
                match workspace.page_manager.read_page(&page_id).await {
                    Ok(pwc) => CommandResult::PageWithContent(pwc),
                    Err(e) => CommandResult::Error(ErrorPayload { message: e }),
                }
            }
            UpdatePage {
                page_id,
                title,
                content,
                icon,
            } => {
                let Some(workspace) = &self.workspace else {
                    return CommandResult::Error(ErrorPayload {
                        message: "No active workspace".into(),
                    });
                };
                // Load existing full page (metadata + body)
                let original = match workspace.page_manager.read_page(&page_id).await {
                    Ok(p) => p,
                    Err(e) => return CommandResult::Error(ErrorPayload { message: e }),
                };

                let mut updated_page = original.page.clone();
                let mut metadata_changed = false;
                if let Some(t) = title {
                    if t != updated_page.title {
                        updated_page.title = t.trim().to_string();
                        // Always recompute slug from (new) title
                        let new_slug = slugify!(&updated_page.title);
                        if new_slug != updated_page.slug {
                            updated_page.slug = new_slug;
                        }
                        metadata_changed = true;
                    }
                }
                if let Some(ic) = icon {
                    if ic != updated_page.icon.clone().unwrap_or_default() {
                        updated_page.icon = Some(ic);
                        metadata_changed = true;
                    }
                }
                if metadata_changed {
                    updated_page.updated_at = Some(Utc::now());
                }

                let new_body = content.unwrap_or(original.content.clone());

                // Persist (metadata and/or body) if anything changed
                let toc_item = workspace.page_manager.make_toc_item(&updated_page).await;
                if metadata_changed || new_body != original.content {
                    if let Err(e) = workspace
                        .page_manager
                        .write_full_page(&updated_page, &new_body)
                        .await
                    {
                        return CommandResult::Error(ErrorPayload {
                            message: format!("Failed to save page: {e}"),
                        });
                    }

                    // If metadata changed (title/icon) broadcast TOC update (Update action)
                    if metadata_changed {
                        let _ = workspace.events_tx.send(Event::TocUpdated {
                            id: updated_page.id.clone(),
                            item: Some(toc_item.clone()),
                            action: TOCUpdateAction::Update,
                        });
                    }
                }

                CommandResult::Page(updated_page)
            }
            SaveRemoteWorkspaces { .. } => CommandResult::Error(ErrorPayload {
                message: "SaveRemoteWorkspaces not supported".into(),
            }),
            SwitchWorkspace { id: _ } => CommandResult::Error(ErrorPayload {
                message: "SwitchWorkspace not supported".into(),
            }),
        }
    }
}
