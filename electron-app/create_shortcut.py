"""
创建 AI Career Copilot 桌面快捷方式
运行此脚本将在桌面上生成一个 .lnk 快捷方式
"""
import os
import sys

def create_desktop_shortcut():
    # 获取桌面路径
    desktop = os.path.join(os.path.expanduser("~"), "Desktop")
    if not os.path.exists(desktop):
        desktop = os.path.join(os.path.expanduser("~"), "OneDrive", "Desktop")
    
    # 快捷方式路径
    shortcut_path = os.path.join(desktop, "AI Career Copilot.lnk")
    
    # 目标 bat 文件路径（当前脚本所在目录）
    script_dir = os.path.dirname(os.path.abspath(__file__))
    target = os.path.join(script_dir, "AI_Career_Copilot.bat")
    icon_path = os.path.join(script_dir, "assets", "icon.ico")
    
    try:
        import winshell
        from win32com.client import Dispatch
        
        shell = Dispatch('WScript.Shell')
        shortcut = shell.CreateShortCut(shortcut_path)
        shortcut.Targetpath = target
        shortcut.WorkingDirectory = script_dir
        shortcut.IconLocation = icon_path if os.path.exists(icon_path) else target
        shortcut.Description = "AI Career Copilot — Resume-Aware Interview Agent"
        shortcut.save()
        print(f"✅ 桌面快捷方式已创建：{shortcut_path}")
        
    except ImportError:
        # 如果没有 win32com，用 PowerShell 创建
        ps_cmd = f'''
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("{shortcut_path}")
$Shortcut.TargetPath = "{target}"
$Shortcut.WorkingDirectory = "{script_dir}"
$Shortcut.IconLocation = "{icon_path if os.path.exists(icon_path) else target}"
$Shortcut.Description = "AI Career Copilot - Resume-Aware Interview Agent"
$Shortcut.Save()
Write-Host "OK"
'''
        result = os.system(f'powershell -Command "{ps_cmd}"')
        if result == 0:
            print(f"✅ 桌面快捷方式已创建：{shortcut_path}")
        else:
            print(f"❌ 创建失败，请手动将 AI_Career_Copilot.bat 发送到桌面快捷方式")
            print(f"   文件位置：{target}")

if __name__ == "__main__":
    create_desktop_shortcut()
