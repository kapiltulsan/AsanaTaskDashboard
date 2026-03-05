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

## 📦 Building for Production (.exe)

When you are ready to distribute this to non-technical users, you can bundle the entire application (Python server + React frontend) into a single folder or executable using `PyInstaller`.

**Prerequisites:**
You must have Python, `pip`, and Node.js (`npm`) installed on your building machine.

1. Ensure all `requirements.txt` dependencies are installed, plus PyInstaller:
   ```bash
   pip install pyinstaller
   ```
2. Run the build script from the root directory:
   ```bash
   python build.py
   ```

**What the build script does:**
1. Runs `npm run build` in the `frontend` directory.
2. Copies the resulting React static files to `backend/static`.
3. Invokes PyInstaller to bundle `backend/main.py` and the `static/` folder into a distributable package.

You will find the resulting application in a newly created `dist/AsanaSentinel` directory. Simply zip that folder and send it to your users—or have them run `AsanaSentinel.exe` directly!
