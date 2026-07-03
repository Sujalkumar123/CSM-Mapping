import subprocess
import os
import sys

# Get absolute path of this directory
base_dir = os.path.dirname(os.path.abspath(__file__))

# Path to python.exe inside virtual environment
venv_python = os.path.join(base_dir, ".venv", "Scripts", "python.exe")
main_py = os.path.join(base_dir, "Main.py")

if not os.path.exists(venv_python):
    print("Virtual environment not found in .venv folder. Trying global python...")
    venv_python = sys.executable

print(f"Launching: {venv_python} -m streamlit run {main_py}")

try:
    # Launch Streamlit server
    subprocess.run([venv_python, "-m", "streamlit", "run", main_py])
except Exception as e:
    print(f"\nError occurred while starting the server: {e}")
    input("\nPress Enter to exit...")
