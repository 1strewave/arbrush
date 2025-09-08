import { app, BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let win, pyProc;

function startPython() {
  const serverPath = path.join(__dirname, "..", "backend", "server.py");
  const pythonCmd = os.platform() === "win32" ? "py" : "python3";
  pyProc = spawn(pythonCmd, [serverPath], { stdio: "inherit" });
  pyProc.on("exit", () => (pyProc = null));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#0b0b0c",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true
    }
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => { startPython(); createWindow(); });
app.on("window-all-closed", () => { if (pyProc) pyProc.kill(); if (process.platform !== "darwin") app.quit(); });
