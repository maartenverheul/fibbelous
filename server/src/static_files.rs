use std::path::{Component, Path, PathBuf};

use hyper::{Response, StatusCode};
use jsonrpsee::core::http_helpers::{Body, Response as RpcResponse};

/// Resolve a request path under `static_dir`, rejecting path traversal.
pub fn resolve_file(static_dir: &Path, request_path: &str) -> Option<PathBuf> {
    let relative = request_path.trim_start_matches('/');
    let path = if relative.is_empty() {
        static_dir.join("index.html")
    } else {
        let candidate = PathBuf::from(relative);
        if candidate
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
        {
            return None;
        }
        static_dir.join(candidate)
    };

    if path.is_file() {
        return Some(path);
    }

    if path.is_dir() {
        let index = path.join("index.html");
        if index.is_file() {
            return Some(index);
        }
    }

    None
}

pub fn spa_index(static_dir: &Path) -> Option<PathBuf> {
    let index = static_dir.join("index.html");
    index.is_file().then_some(index)
}

/// Missing assets (paths with a file extension) should 404; other routes fall back to the SPA.
pub fn should_spa_fallback(request_path: &str) -> bool {
    Path::new(request_path.trim_start_matches('/'))
        .extension()
        .is_none_or(|ext| ext.is_empty())
}

pub async fn read_response(path: &Path) -> Option<RpcResponse> {
    let bytes = tokio::fs::read(path).await.ok()?;
    let content_type = content_type_for(path);
    Some(
        Response::builder()
            .status(StatusCode::OK)
            .header("content-type", content_type)
            .body(Body::from(bytes))
            .unwrap_or_else(|_| {
                Response::builder()
                    .status(StatusCode::INTERNAL_SERVER_ERROR)
                    .body(Body::empty())
                    .unwrap()
            }),
    )
}

fn content_type_for(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .as_deref()
    {
        Some("html") => "text/html; charset=utf-8",
        Some("js") | Some("mjs") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json") => "application/json; charset=utf-8",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("ico") => "image/x-icon",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        Some("ttf") => "font/ttf",
        Some("map") => "application/json; charset=utf-8",
        Some("txt") => "text/plain; charset=utf-8",
        Some("wasm") => "application/wasm",
        _ => "application/octet-stream",
    }
}
