!macro customHeader
  !system "echo '' > ${BUILD_RESOURCES_DIR}/customHeader"
!macroend

!macro customInit
  !system "echo '' > ${BUILD_RESOURCES_DIR}/customInit"
!macroend

!macro customInstall
  # Create application data directory
  CreateDirectory "$APPDATA\EvolveAI"
  CreateDirectory "$APPDATA\EvolveAI\logs"
  CreateDirectory "$APPDATA\EvolveAI\data"
  CreateDirectory "$APPDATA\EvolveAI\models"
  
  # Copy additional files
  SetOutPath "$INSTDIR"
  File /r "installer\*.*"
  File "launch-evolveai.bat"
  File "diagnose-evolveai.bat"
  File "test-dev.bat"
  
  # Create desktop shortcut
  CreateShortCut "$DESKTOP\EvolveAI.lnk" "$INSTDIR\EvolveAI.exe" "" "$INSTDIR\EvolveAI.exe" 0
  
  # Create start menu shortcuts
  CreateDirectory "$SMPROGRAMS\EvolveAI"
  CreateShortCut "$SMPROGRAMS\EvolveAI\EvolveAI.lnk" "$INSTDIR\EvolveAI.exe" "" "$INSTDIR\EvolveAI.exe" 0
  CreateShortCut "$SMPROGRAMS\EvolveAI\Diagnose EvolveAI.lnk" "$INSTDIR\diagnose-evolveai.bat" "" "$INSTDIR\diagnose-evolveai.bat" 0
  CreateShortCut "$SMPROGRAMS\EvolveAI\Uninstall.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\Uninstall.exe" 0
!macroend

!macro customUnInit
  # Remove application data (optional - user might want to keep it)
  # RMDir /r "$APPDATA\EvolveAI"
!macroend

!macro customUnInstall
  # Remove shortcuts
  Delete "$DESKTOP\EvolveAI.lnk"
  Delete "$SMPROGRAMS\EvolveAI\EvolveAI.lnk"
  Delete "$SMPROGRAMS\EvolveAI\Diagnose EvolveAI.lnk"
  Delete "$SMPROGRAMS\EvolveAI\Uninstall.lnk"
  RMDir "$SMPROGRAMS\EvolveAI"
!macroend 