import subprocess
import os

# Path to installed Git
git_path = r"C:\Program Files\Git\cmd\git.exe"
base_dir = os.path.dirname(os.path.abspath(__file__))

# Git config name/email if not set
subprocess.run([git_path, "config", "--global", "user.email", "sujal@example.com"], cwd=base_dir)
subprocess.run([git_path, "config", "--global", "user.name", "Sujal Kumar"], cwd=base_dir)

# Git setup commands
commands = [
    [git_path, "init"],
    [git_path, "remote", "add", "origin", "https://github.com/Sujalkumar123/CSM-Mapping.git"],
    [git_path, "branch", "-M", "main"],
    [git_path, "add", "Main.py", "data_loader.py", "style.css", "requirements.txt", "start_streamlit.py", "csm_company_mappings (14).xlsx"],
    [git_path, "commit", "-m", "Initialize CSM Dashboard with Edit/Remove and line-by-line list"],
    [git_path, "push", "-u", "origin", "main"]
]

print("Starting Git operations...")

for cmd in commands:
    print(f"\nRunning: {' '.join(cmd)}")
    res = subprocess.run(cmd, cwd=base_dir, capture_output=True, text=True)
    if res.stdout:
        print(f"STDOUT:\n{res.stdout}")
    if res.stderr:
        print(f"STDERR:\n{res.stderr}")
    
    # If remote add fails because it already exists, just continue
    if "remote add" in " ".join(cmd) and "already exists" in res.stderr:
        continue
