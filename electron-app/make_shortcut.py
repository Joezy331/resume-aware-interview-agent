"""
创建桌面快捷方式 - 使用 Python subprocess + PowerShell
不依赖 win32com，兼容性更好
"""
import subprocess
import os

script_dir = r"E:\codex_projects\A Career Copilot\electron-app"
target = os.path.join(script_dir, "AI_Career_Copilot.bat")
icon_path = os.path.join(script_dir, "assets", "icon.ico")
desktop = r"C:\Users\jiang\Desktop"
shortcut_path = os.path.join(desktop, "AI Career Copilot.lnk")

ps_script = f"""
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut('{shortcut_path}')
$Shortcut.TargetPath = '{target}'
$Shortcut.WorkingDirectory = '{script_dir}'
$Shortcut.IconLocation = '{icon_path}'
$Shortcut.Description = 'AI Career Copilot - Resume-Aware Interview Agent'
$Shortcut.Save()
Write-Host 'Shortcut created successfully'
"""

result = subprocess.run(
    ["powershell", "-ExecutionPolicy", "Bypass", "-Command", ps_script],
    capture_output=True, text=True
)
print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)
print("Return code:", result.returncode)
print("Shortcut exists:", os.path.exists(shortcut_path))
