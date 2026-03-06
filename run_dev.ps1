# run_dev.ps1
# Automates starting the Asana Sentinel development environment

Write-Host "🚀 Launching Asana Sentinel Workspace..." -ForegroundColor Cyan

# Change directory
cd "C:\Users\Kapil Tulsan\OneDrive - Kapil R Tulsan\PyCharms\AsanaTaskDashboard\AsanaTaskDashboard"


# 1. Start the Backend in a separate window
Write-Host "Starting Python Backend (FastAPI)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\venv\Scripts\activate; py -m backend.main"

# 2. Wait a moment for backend to initialize
Start-Sleep -Seconds 2

# 3. Start the Frontend in a separate window
Write-Host "Starting React Frontend (Vite)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

# 4. Open the browser to the frontend
Write-Host "Opening Dashboard..."
Start-Sleep -Seconds 3 # Give Vite a few seconds to start the server
Start-Process "http://localhost:5173"

Write-Host "All systems GO! Check the newly opened windows for logs." -ForegroundColor Green
