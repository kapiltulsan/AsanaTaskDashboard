# Asana Sentinel Workspace

## 🚀 Running for Development

The application consists of a Python FastAPI backend and a React/Vite frontend.

### 1. Start the Backend
```bash
# Optional: Create a virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python backend/main.py
```
*The backend will run on `http://127.0.0.1:8000`*

### 2. Start the Frontend
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
*The React app will be served locally, proxying API requests to port 8000.*

---

---

## 📦 Building for Production (.exe)

When you are ready to distribute this to non-technical users, you can bundle the entire application (Python server + React frontend) into a single standalone executable.

**Prerequisites:**
You must have Python, `pip`, and Node.js (`npm`) installed on your building machine.

1. Ensure all `requirements.txt` dependencies are installed:
   ```bash
   pip install -r requirements.txt
   ```
2. Run the build script from the root directory:
   ```bash
   .\venv\Scripts\python.exe build.py
   ```

**What the build script does:**
1. Runs `npm run build` in the `frontend` directory.
2. Copies the resulting React static files to `backend/static`.
3. Invokes PyInstaller to bundle everything into a **single file** `AsanaSentinel.exe`.

---

## 🏗️ Sharing with End Users

To share the application, you only need to provide the `AsanaSentinel.exe` file found in the `dist` folder.

### **User Instructions:**
1. **No Installation Required**: Users simply run `AsanaSentinel.exe`.
2. **First Run Setup**: 
   - Upon launching, the application will start a local server at `http://127.0.0.1:8000`.
   - The user will be prompted to enter their **Asana Personal Access Token (PAT)** and **Project GID** in the Settings tab.
3. **Local Data**: The application creates a local database file (`asana_sentinel.db`) in the same folder as the EXE to securely store settings and cached task data.
4. **Firewall**: The first time it runs, Windows may ask for permission to allow the application to communicate on the network (this is for the local web server to function). Users should click "Allow Access".

> [!TIP]
> It is recommended to zip the `AsanaSentinel.exe` before sending it to ensure it remains intact and avoids being flagged by some email scanners as a raw executable.

