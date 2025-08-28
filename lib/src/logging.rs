use std::path::Path;

use time::macros::format_description;
use time::UtcOffset;
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::fmt::time::OffsetTime;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

pub fn init(log_dir: &Path) {
    // Resolve log directory inside the app data dir

    let _ = std::fs::create_dir_all(&log_dir);

    // Rolling daily file appender; ensure files end with .log (e.g., fibbelous-YYYY-MM-DD.log)
    let file_appender: RollingFileAppender =
        tracing_appender::rolling::RollingFileAppender::builder()
            .rotation(Rotation::DAILY)
            .filename_prefix("fibbelous")
            .filename_suffix("log")
            .build(log_dir)
            .expect("failed to create rolling file appender");

    // Timer with milliseconds, e.g. 2025-08-26 14:03:12.345
    let time_format =
        format_description!("[year]-[month]-[day]T[hour]:[minute]:[second].[subsecond digits:3]Z");
    let timer = OffsetTime::new(UtcOffset::UTC, time_format);

    // Console layer
    let console_layer = fmt::layer()
        .with_timer(timer.clone())
        .with_target(true)
        .with_thread_ids(false)
        .with_level(true)
        .compact();

    // File layer (plain text)
    let file_layer = fmt::layer()
        .with_timer(timer)
        .with_writer(file_appender)
        .with_ansi(false)
        .with_target(true)
        .with_level(true)
        .compact();

    // Env filter (default to info if RUST_LOG not set)
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::registry()
        .with(filter)
        .with(console_layer)
        .with(file_layer)
        .init();
}
