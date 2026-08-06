Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\convidado 1\Documents\zherkeysite"
WshShell.Run "pythonw.exe zherkeys_tray_agent.py", 0, False
