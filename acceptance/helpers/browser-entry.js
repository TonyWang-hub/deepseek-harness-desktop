import { app, BrowserWindow } from 'electron'

const target = process.env.PARITY_URL
if (!target) throw new Error('PARITY_URL is required')

let window
void app.whenReady().then(async () => {
  window = new BrowserWindow({
    width: 1280,
    height: 840,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })
  await window.loadURL(target)
})

app.on('window-all-closed', () => app.quit())
process.on('SIGTERM', () => app.quit())
