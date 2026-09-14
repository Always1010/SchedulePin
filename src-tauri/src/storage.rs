use crate::model::HelperState;
use std::{fs, path::PathBuf};

pub fn data_dir() -> Result<PathBuf, String> {
    let root = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "无法定位当前用户的 LocalAppData 目录".to_string())?;
    let path = root.join("SchedulePin");
    fs::create_dir_all(&path).map_err(|error| format!("无法创建助手数据目录：{error}"))?;
    Ok(path)
}

pub fn generated_dir() -> Result<PathBuf, String> {
    let path = data_dir()?.join("generated");
    fs::create_dir_all(&path).map_err(|error| format!("无法创建壁纸输出目录：{error}"))?;
    Ok(path)
}

pub fn backup_dir() -> Result<PathBuf, String> {
    let path = data_dir()?.join("wallpaper-backup");
    fs::create_dir_all(&path).map_err(|error| format!("无法创建壁纸备份目录：{error}"))?;
    Ok(path)
}

pub fn load_state() -> Result<HelperState, String> {
    let path = data_dir()?.join("helper-state.json");
    if !path.exists() {
        return Ok(HelperState::default());
    }
    let content = fs::read_to_string(&path).map_err(|error| format!("无法读取助手状态：{error}"))?;
    serde_json::from_str(&content).map_err(|error| format!("助手状态文件损坏：{error}"))
}

pub fn save_state(state: &HelperState) -> Result<(), String> {
    let path = data_dir()?.join("helper-state.json");
    let temporary = data_dir()?.join("helper-state.tmp.json");
    let content = serde_json::to_vec_pretty(state).map_err(|error| error.to_string())?;
    fs::write(&temporary, content).map_err(|error| format!("无法暂存助手状态：{error}"))?;
    if path.exists() {
        fs::remove_file(&path).map_err(|error| format!("无法替换助手状态：{error}"))?;
    }
    fs::rename(temporary, path).map_err(|error| format!("无法保存助手状态：{error}"))
}
