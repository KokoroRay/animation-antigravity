Set Wsh = CreateObject("WScript.Shell")
rc = Wsh.Run("cmd /c node -v > node_ver.txt", 0, True)
