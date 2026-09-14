use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanItem {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub scheduled_date: String,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub priority: i32,
    #[serde(default)]
    pub sort_order: i32,
    pub recurring_daily: bool,
    pub completed: bool,
    #[serde(default)]
    pub completed_date: Option<String>,
    #[serde(default)]
    pub completed_at: Option<String>,
    #[serde(default)]
    pub archived_at: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLayout {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl Default for DesktopLayout {
    fn default() -> Self {
        Self {
            x: 0.68,
            y: 0.06,
            width: 0.28,
            height: 0.82,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default)]
    pub principle: String,
    #[serde(default)]
    pub theme: String,
    #[serde(default)]
    pub font_family: String,
    #[serde(default = "default_font_scale")]
    pub font_scale: f64,
    #[serde(default)]
    pub density: String,
    #[serde(default = "default_card_radius")]
    pub card_radius: f64,
    pub opacity: f64,
    pub display_mode: String,
    pub selected_monitor_id: Option<String>,
    pub desktop_enabled: bool,
    #[serde(default)]
    pub layouts: HashMap<String, DesktopLayout>,
}

fn default_font_scale() -> f64 { 1.0 }
fn default_card_radius() -> f64 { 20.0 }

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSnapshot {
    pub protocol_version: u32,
    pub date: String,
    pub generated_at: String,
    pub items: Vec<PlanItem>,
    pub settings: AppSettings,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum NativeRequest {
    Status {
        #[serde(rename = "protocolVersion")]
        protocol_version: u32,
    },
    Sync {
        snapshot: DesktopSnapshot,
    },
    Restore {
        #[serde(rename = "protocolVersion")]
        protocol_version: u32,
    },
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub id: String,
    pub index: usize,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub primary: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HelperResponse {
    pub version: &'static str,
    pub desktop_enabled: bool,
    pub last_sync: Option<String>,
    pub monitors: Vec<MonitorInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl HelperResponse {
    pub fn failure(error: String) -> Self {
        Self {
            version: env!("CARGO_PKG_VERSION"),
            desktop_enabled: false,
            last_sync: None,
            monitors: Vec::new(),
            error: Some(error),
        }
    }
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HelperState {
    pub desktop_enabled: bool,
    pub last_sync: Option<String>,
    pub last_rendered_date: Option<String>,
    pub last_monitor_signature: Option<String>,
    pub snapshot: Option<DesktopSnapshot>,
    pub original: Option<WallpaperBackup>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WallpaperBackup {
    pub position: i32,
    pub background_color: u32,
    pub monitors: Vec<MonitorWallpaperBackup>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorWallpaperBackup {
    pub id: String,
    pub original_path: String,
    pub backup_path: Option<String>,
}
