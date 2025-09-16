use serde::{Deserialize, Serialize};

use crate::pages::TOCItem;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TOCUpdateAction {
    Add,
    Remove,
    Update,
}

/// Events emitted by workspace operations that clients can subscribe to via WebSocket.
/// Keep naming consistent with existing command naming conventions (camelCase).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "camelCase")]
pub enum Event {
    /// The table-of-contents (TOC) changed. Optional parent denotes a subtree; None means root.
    TocUpdated {
        id: String,
        item: Option<TOCItem>,
        action: TOCUpdateAction,
    },
}
