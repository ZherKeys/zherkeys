Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\convidado 1\Documents\zherkeysite"
WshShell.Run "cmd /c node ""C:\Users\convidado 1\Documents\zherkeysite\scripts\auto-sync-pc.js"" --daemon", 0, False
