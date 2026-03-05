import os
import subprocess
import shutil

def build_project():
    print("🚀 Starting Asana Sentinel Build Process...")

    # Paths
    base_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(base_dir, "frontend")
    backend_dir = os.path.join(base_dir, "backend")
    
    # Path where React's Vite build outputs files
    frontend_dist = os.path.join(frontend_dir, "dist")
    
    # Path inside backend to host the static files
    backend_static = os.path.join(backend_dir, "static")

    # Step 1: Build the React Application
    print("\n📦 Building React Frontend...")
    try:
        # Requires Node/npm to be installed
        subprocess.run(["npm", "run", "build"], cwd=frontend_dir, check=True, shell=True)
    except subprocess.CalledProcessError:
        print("❌ Error building frontend. Do you have Node.js installed?")
        return

    # Step 2: Move React build to Backend static folder
    print("\n🚚 Moving static files to backend...")
    if os.path.exists(backend_static):
        shutil.rmtree(backend_static)
        
    shutil.copytree(frontend_dist, backend_static)

    # Step 3: Run PyInstaller
    print("\n⚙️ Running PyInstaller...")
    # NOTE: You'll need to modify backend/main.py slightly to mount the /static 
    # folder to serve the React app in production, rather than relying on CORS
    # and two separate servers.
    
    # We use --add-data to include the React build inside the executable.
    # On Windows, PyInstaller uses ';' as the separator for add-data.
    add_data_arg = f"{backend_static};static"
    
    pyinstaller_cmd = [
        "pyinstaller",
        "--noconfirm",
        "--name=AsanaSentinel",
        "--onedir", # Use --onefile for a single massive exe, --onedir is generally safer/faster
        "--hidden-import=uvicorn.logging",
        "--hidden-import=uvicorn.loops",
        "--hidden-import=uvicorn.loops.auto",
        "--hidden-import=uvicorn.protocols",
        "--hidden-import=uvicorn.protocols.http",
        "--hidden-import=uvicorn.protocols.http.auto",
        "--hidden-import=uvicorn.protocols.websockets",
        "--hidden-import=uvicorn.protocols.websockets.auto",
        "--hidden-import=uvicorn.lifespan",
        "--hidden-import=uvicorn.lifespan.on",
        f"--add-data={add_data_arg}",
        os.path.join(backend_dir, "main.py")
    ]

    try:
        subprocess.run(pyinstaller_cmd, cwd=base_dir, check=True)
        print("\n✅ Build complete! Check the 'dist' folder.")
    except subprocess.CalledProcessError:
        print("\n❌ PyInstaller failed. Try running it manually.")

if __name__ == "__main__":
    build_project()
