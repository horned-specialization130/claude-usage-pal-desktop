# 🐾 AI Pet Usage Desktop App

A desktop pet application built with **Tauri**, **React**, **TypeScript**, and **Vite**.

---

## 🚀 Installation

### 👤 For Human Users
1. Download the latest setup installer (`ai-pet-usage_..._x64-setup.exe`) from the [GitHub Releases Page](https://github.com/chanyutl-dev01/claude-usage-pal-desktop/releases/latest).
2. Double-click the downloaded `.exe` file to install and launch the application.

---

### 🤖 For AI Agents (Automated One-Liner Install)
AI agents can automatically download and silently install the latest release on Windows by executing this PowerShell command:

```powershell
$r = Invoke-RestMethod "https://api.github.com/repos/chanyutl-dev01/claude-usage-pal-desktop/releases/latest"; $url = ($r.assets | Where-Object name -like "*-setup.exe").browser_download_url; $p = "$env:TEMP\ai-pet-usage-setup.exe"; Invoke-WebRequest $url -OutFile $p; Start-Process $p -ArgumentList "/S" -Wait
```

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run dev server & Tauri window
npm run tauri dev

# Build release bundle
npm run tauri build
```

