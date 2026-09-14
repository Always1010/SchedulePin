use crate::{handle_request, model::{HelperResponse, NativeRequest}};
use std::io::{self, Read, Write};

const MAX_MESSAGE_BYTES: usize = 8 * 1024 * 1024;

pub fn run() -> Result<(), String> {
    let mut input = io::stdin().lock();
    let mut output = io::stdout().lock();
    loop {
        let mut length = [0_u8; 4];
        match input.read_exact(&mut length) {
            Ok(()) => {}
            Err(error) if error.kind() == io::ErrorKind::UnexpectedEof => return Ok(()),
            Err(error) => return Err(format!("无法读取 Native Messaging 消息长度：{error}")),
        }
        let length = u32::from_le_bytes(length) as usize;
        if length > MAX_MESSAGE_BYTES {
            return Err("Native Messaging 消息超过 8 MB 限制".into());
        }
        let mut content = vec![0; length];
        input.read_exact(&mut content).map_err(|error| format!("无法读取 Native Messaging 消息：{error}"))?;
        let response = match serde_json::from_slice::<NativeRequest>(&content) {
            Ok(request) => handle_request(request),
            Err(error) => HelperResponse::failure(format!("无法解析插件请求：{error}")),
        };
        let encoded = serde_json::to_vec(&response).map_err(|error| error.to_string())?;
        output.write_all(&(encoded.len() as u32).to_le_bytes()).map_err(|error| error.to_string())?;
        output.write_all(&encoded).map_err(|error| error.to_string())?;
        output.flush().map_err(|error| error.to_string())?;
    }
}
