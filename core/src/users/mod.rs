use std::sync::Arc;

use crate::{command_handler::CommandHandler, state::AppState, workspaces::LoadedWorkspace};
use tokio::sync::RwLock;

pub struct UserInfo {
    pub id: i32,
    pub username: String,
    pub email: String,
    pub is_admin: bool,
    pub created_at: String,
    pub updated_at: String,
}

pub struct ConnectedUserContext {
    pub info: UserInfo,
    pub token: Option<String>,
    pub active_workspace: RwLock<Option<Arc<LoadedWorkspace>>>,
    pub command_handler: CommandHandler,
}

impl ConnectedUserContext {
    pub fn new_local(app: Arc<AppState>) -> Self {
        ConnectedUserContext {
            info: UserInfo {
                id: 0,
                username: "local".into(),
                email: "local@example.com".into(),
                is_admin: false,
                created_at: "now".into(),
                updated_at: "now".into(),
            },
            token: None,
            active_workspace: RwLock::new(None),
            command_handler: CommandHandler::new(app, None),
        }
    }
}

pub struct UserManager {
    users: Vec<ConnectedUserContext>,
}

impl UserManager {
    pub fn new() -> Self {
        UserManager { users: Vec::new() }
    }

    pub fn add_user(&mut self, user: ConnectedUserContext) {
        self.users.push(user);
    }

    pub fn remove_user_by_id(&mut self, user_id: i32) {
        self.users.retain(|u| u.info.id != user_id);
    }

    pub fn get_user_by_id(&self, user_id: i32) -> Option<&ConnectedUserContext> {
        self.users.iter().find(|u| u.info.id == user_id)
    }

    pub fn list_users(&self) -> &Vec<ConnectedUserContext> {
        &self.users
    }
}
