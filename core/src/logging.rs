use std::path::Path;

use time::macros::format_description;
use time::UtcOffset;
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::fmt::time::OffsetTime;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

/// Initialize tracing/logging.
///
/// Parameters:
/// * `log_dir` - directory where rolling log files are written
/// * `verbose` - when true and `RUST_LOG` not set, default level is `debug`; otherwise `info`.
pub fn init(log_dir: &Path, verbose: bool) {
    // Ensure log directory exists
    let _ = std::fs::create_dir_all(&log_dir);

    // Build daily rolling file appender (.log suffix)
    let file_appender: RollingFileAppender =
        tracing_appender::rolling::RollingFileAppender::builder()
            .rotation(Rotation::DAILY)
            .filename_prefix("fibbelous")
            .filename_suffix("log")
            .build(log_dir)
            .expect("failed to create rolling file appender");

    // Timestamp format with millisecond precision
    let time_format =
        format_description!("[year]-[month]-[day]T[hour]:[minute]:[second].[subsecond digits:3]Z");
    let timer = OffsetTime::new(UtcOffset::UTC, time_format);

    // Console (stdout) layer
    let console_layer = fmt::layer()
        .with_timer(timer.clone())
        .with_target(true)
        .with_thread_ids(false)
        .with_level(true)
        .compact();

    // File layer
    let file_layer = fmt::layer()
        .with_timer(timer)
        .with_writer(file_appender)
        .with_ansi(false)
        .with_target(true)
        .with_level(true)
        .compact();

    // If RUST_LOG is set we respect it. Otherwise use debug when verbose, else info.
    let filter = if std::env::var("RUST_LOG").is_ok() {
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"))
    } else if verbose {
        EnvFilter::new("debug")
    } else {
        EnvFilter::new("info")
    };

    tracing_subscriber::registry()
        .with(filter)
        .with(console_layer)
        .with(file_layer)
        .init();
}
