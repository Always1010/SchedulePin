import { spawn } from "node:child_process";
import { resolve } from "node:path";

const executable = resolve("src-tauri/target/release/schedulepin-helper.exe");
const child = spawn(executable, [], { stdio: ["pipe", "pipe", "inherit"] });
const request = Buffer.from(JSON.stringify({ type: "status", protocolVersion: 1 }), "utf8");
const length = Buffer.alloc(4);
length.writeUInt32LE(request.length);
child.stdin.end(Buffer.concat([length, request]));

const chunks = [];
for await (const chunk of child.stdout) chunks.push(chunk);
const output = Buffer.concat(chunks);
if (output.length < 4) throw new Error("助手没有返回完整的 Native Messaging 响应");
const responseLength = output.readUInt32LE(0);
const response = JSON.parse(output.subarray(4, 4 + responseLength).toString("utf8"));
if (response.error) throw new Error(response.error);
if (!Array.isArray(response.monitors) || response.monitors.length === 0) {
  throw new Error("助手没有检测到显示器");
}
console.log(`Native Messaging 正常：${response.monitors.length} 块显示器，助手版本 ${response.version}`);
