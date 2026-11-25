!macro customInstall
  ; Remove any leftover per-user PhantomPad installation so two copies never coexist
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
  ${if} $0 != ""
    ExecWait '$0 /S'
  ${endIf}

  ${ifNot} ${isUpdated}
    ReadRegStr $0 HKLM "SYSTEM\CurrentControlSet\Services\ViGEmBus" "ImagePath"
    ${if} $0 == ""
      MessageBox MB_YESNO|MB_ICONEXCLAMATION "PhantomPad requires the ViGEmBus driver for virtual gamepad emulation. Setup will download the driver from its official GitHub release and open its installer. Internet access is required. Continue?" IDYES installDrivers
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
