fn main() {
    let mode = std::env::args().nth(1);
    let result = match mode.as_deref() {
        Some("--daemon") => schedulepin_helper::run_daemon(),
        Some("--restore") => schedulepin_helper::restore().map(|_| ()),
        Some("--refresh") => schedulepin_helper::refresh_cached().map(|_| ()),
        _ => schedulepin_helper::run_native_host(),
    };
    if let Err(error) = result {
        eprintln!("SchedulePin Helper: {error}");
        std::process::exit(1);
    }
}
