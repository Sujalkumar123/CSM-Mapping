import subprocess
import os
import sys

# Try standard Git install paths, fallback to git command in path
git_paths = [
    r"C:\Program Files\Git\cmd\git.exe",
    r"C:\Program Files (x86)\Git\cmd\git.exe",
    "git"
]

git_path = "git"
for path in git_paths:
    if path == "git" or os.path.exists(path):
        git_path = path
        break

base_dir = os.path.dirname(os.path.abspath(__file__))

# Configure Git username/email if not set
subprocess.run([git_path, "config", "--global", "user.email", "sujal@example.com"], cwd=base_dir)
subprocess.run([git_path, "config", "--global", "user.name", "Sujal Kumar"], cwd=base_dir)

print("--- Starting Deploy Sequence ---")

# 1. Add modified source files
print("\n1. Staging changed files...")
files_to_add = [
    "go_live.py", "go_live.bat", "run_react_app.bat", "clean_project.bat",
    "slack_members.csv", "csm_company_mappings (14).xlsx",
    "package.json", "package-lock.json", ".gitignore",
    "NewLayout/frontend", "NewLayout/backend"
]

for f in files_to_add:
    if os.path.exists(os.path.join(base_dir, f)):
        subprocess.run([git_path, "add", f], cwd=base_dir)

# 2. Commit
print("\n2. Committing changes...")
commit_msg = "Optimize backend response time: add in-memory Excel caching, defer WhatsApp init, and add UI skeleton loading state"
res_commit = subprocess.run([git_path, "commit", "-m", commit_msg], cwd=base_dir, capture_output=True, text=True)
if res_commit.stdout:
    print(res_commit.stdout.strip())
if res_commit.stderr:
    print(res_commit.stderr.strip())

# 2.5. Pull remote changes
print("\n2.5. Pulling latest remote changes...")
res_pull = subprocess.run([git_path, "pull", "origin", "main", "--rebase"], cwd=base_dir, capture_output=True, text=True)
if res_pull.stdout:
    print(res_pull.stdout.strip())
if res_pull.stderr:
    print(res_pull.stderr.strip())

# 3. Push
print("\n3. Pushing changes to GitHub (origin main)...")
res_push = subprocess.run([git_path, "push", "origin", "main"], cwd=base_dir, capture_output=True, text=True)
if res_push.stdout:
    print(res_push.stdout.strip())
if res_push.stderr:
    print(res_push.stderr.strip())

print("\n--- Deploy Sequence Finished! ---")
