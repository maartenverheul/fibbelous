use emojis;
use tracing::debug;

/// Normalize and validate a workspace icon. Ensures it is exactly one emoji; otherwise returns None.
pub fn normalize_icon(icon: &Option<String>) -> Option<String> {
    match icon {
        Some(ic) if is_single_emoji(ic) => Some(ic.clone()),
        Some(_) => {
            debug!("workspace icon invalid (not a single emoji), clearing to None");
            None
        }
        None => None,
    }
}

/// Lightweight single emoji validator using the `emojis` crate list.
fn is_single_emoji(s: &str) -> bool {
    if s.is_empty() {
        return false;
    }
    emojis::iter().any(|e| e.as_str() == s)
}
