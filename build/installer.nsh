!macro customInstall
  ${ifNot} ${isUpdated}
    ReadRegStr $0 HKLM "SYSTEM\CurrentControlSet\Services\ViGEmBus" "ImagePath"
    ReadRegStr $1 HKLM "SYSTEM\CurrentControlSet\Services\vjoy" "ImagePath"
    ${if} $0 == ""
    ${orIf} $1 == ""
      MessageBox MB_YESNO|MB_ICONEXCLAMATION "PhantomPad requires both ViGEmBus and vJoy drivers. Setup will download any missing driver from its official GitHub release and open its installer. Internet access is required. Continue?" IDYES installDrivers
      Abort "Required PhantomPad drivers were not approved."
      installDrivers:
      SetOutPath "$PLUGINSDIR"
      File "${BUILD_RESOURCES_DIR}\install-drivers.ps1"
      nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\install-drivers.ps1"'
      Pop $0
      ${if} $0 != 0
        MessageBox MB_OK|MB_ICONSTOP "The required driver setup did not complete. PhantomPad setup will stop. Check your internet connection and try again."
        Abort "Required driver setup failed."
      ${endIf}
    ${endIf}
  ${endIf}
!macroend
