; NSIS Installer Script for EvolveAI
; This script creates a professional Windows installer

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"

; Basic settings
Name "EvolveAI"
OutFile "EvolveAI-Setup.exe"
InstallDir "$PROGRAMFILES64\EvolveAI"
InstallDirRegKey HKLM "Software\EvolveAI" "Install_Dir"

; Request application privileges
RequestExecutionLevel admin

; Version information
VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "EvolveAI"
VIAddVersionKey "CompanyName" "WulfForge"
VIAddVersionKey "LegalCopyright" "© 2024 WulfForge. All rights reserved."
VIAddVersionKey "FileDescription" "EvolveAI Desktop Application Installer"
VIAddVersionKey "FileVersion" "1.0.0.0"
VIAddVersionKey "ProductVersion" "1.0.0.0"

; Interface settings
!define MUI_ABORTWARNING
!define MUI_ICON "assets/evolveai-icon.ico"
!define MUI_UNICON "assets/evolveai-icon.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "assets/welcome.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "assets/welcome.bmp"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Languages
!insertmacro MUI_LANGUAGE "English"

; Installer sections
Section "EvolveAI" SecEvolveAI
    SetOutPath "$INSTDIR"
    
    ; Main application files
    File /r "app\*.*"
    File /r "node_modules\*.*"
    File "package.json"
    File "main.js"
    File "preload.js"
    
    ; Create uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"
    
    ; Registry information for add/remove programs
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\EvolveAI" "DisplayName" "EvolveAI"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\EvolveAI" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\EvolveAI" "DisplayIcon" "$INSTDIR\assets\icon.ico"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\EvolveAI" "Publisher" "WulfForge"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\EvolveAI" "URLInfoAbout" "https://github.com/WulfForge/EvolveAI"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\EvolveAI" "URLUpdateInfo" "https://github.com/WulfForge/EvolveAI/releases"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\EvolveAI" "DisplayVersion" "1.0.0"
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\EvolveAI" "NoModify" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\EvolveAI" "NoRepair" 1
    
    ; Store installation folder
    WriteRegStr HKLM "Software\EvolveAI" "Install_Dir" "$INSTDIR"
    
    ; Create desktop shortcut
    CreateShortCut "$DESKTOP\EvolveAI.lnk" "$INSTDIR\EvolveAI.exe" "" "$INSTDIR\assets\icon.ico"
    
    ; Create start menu shortcut
    CreateDirectory "$SMPROGRAMS\EvolveAI"
    CreateShortCut "$SMPROGRAMS\EvolveAI\EvolveAI.lnk" "$INSTDIR\EvolveAI.exe" "" "$INSTDIR\assets\icon.ico"
    CreateShortCut "$SMPROGRAMS\EvolveAI\Uninstall.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\assets\icon.ico"
    
    ; Create application data directory
    CreateDirectory "$APPDATA\EvolveAI"
    CreateDirectory "$APPDATA\EvolveAI\logs"
    CreateDirectory "$APPDATA\EvolveAI\config"
    CreateDirectory "$APPDATA\EvolveAI\data"
    
    ; Set file permissions
    AccessControl::GrantOnFile "$INSTDIR" "(BU)" "FullAccess"
    AccessControl::GrantOnFile "$APPDATA\EvolveAI" "(BU)" "FullAccess"
SectionEnd

Section "Start Menu Shortcut" SecStartMenu
    ; This section is always selected
SectionEnd

Section "Desktop Shortcut" SecDesktop
    ; This section is always selected
SectionEnd

; Uninstaller section
Section "Uninstall"
    ; Remove files and uninstaller
    Delete "$INSTDIR\Uninstall.exe"
    RMDir /r "$INSTDIR"
    
    ; Remove shortcuts
    Delete "$DESKTOP\EvolveAI.lnk"
    Delete "$SMPROGRAMS\EvolveAI\EvolveAI.lnk"
    Delete "$SMPROGRAMS\EvolveAI\Uninstall.lnk"
    RMDir "$SMPROGRAMS\EvolveAI"
    
    ; Remove registry keys
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\EvolveAI"
    DeleteRegKey HKLM "Software\EvolveAI"
    
    ; Remove application data (optional - ask user)
    MessageBox MB_YESNO "Do you want to remove all EvolveAI data and settings? This will delete all conversations, custom APIs, and configuration files." IDNO NoDataRemoval
    RMDir /r "$APPDATA\EvolveAI"
    NoDataRemoval:
SectionEnd

; Custom welcome page text
!define MUI_WELCOMEPAGE_TITLE "Welcome to EvolveAI Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of EvolveAI, the advanced AI desktop application that integrates conversational AI, vector memory, Google Workspace APIs, and custom API support for unlimited extensibility and multi-way AI conversations.$\r$\n$\r$\nEvolveAI features:$\r$\n• Hybrid AI Architecture (Google AI Studio + Local LLMs)$\r$\n• Multi-AI Collaboration with unlimited participants$\r$\n• Custom API Manager for any external service$\r$\n• Google Workspace Integration$\r$\n• Privacy-focused local processing$\r$\n• Cost-effective AI solutions$\r$\n$\r$\nClick Next to continue."

; Custom finish page text
!define MUI_FINISHPAGE_TITLE "Installation Complete"
!define MUI_FINISHPAGE_TEXT "EvolveAI has been successfully installed on your computer.$\r$\n$\r$\nWhat's next:$\r$\n1. Launch EvolveAI from the Start Menu or Desktop shortcut$\r$\n2. Configure your Google AI Studio API key (free)$\r$\n3. Optionally install local LLMs for privacy$\r$\n4. Start creating custom AI agents and multi-way conversations$\r$\n$\r$\nFor help and documentation, visit:$\r$\nhttps://github.com/WulfForge/EvolveAI"

!define MUI_FINISHPAGE_RUN "$INSTDIR\EvolveAI.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch EvolveAI now"
!define MUI_FINISHPAGE_LINK "Visit EvolveAI on GitHub"
!define MUI_FINISHPAGE_LINK_LOCATION "https://github.com/WulfForge/EvolveAI"

; Function to check if running as administrator
Function .onInit
    ${If} ${RunningX64}
        SetRegView 64
    ${Else}
        MessageBox MB_OK|MB_ICONSTOP "This application requires a 64-bit Windows system."
        Abort
    ${EndIf}
    
    ; Check if already installed
    ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\EvolveAI" "UninstallString"
    StrCmp $R0 "" done
    
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "EvolveAI is already installed. $\n$\nClick 'OK' to remove the previous version or 'Cancel' to cancel this update." IDOK uninst
    Abort
    
    uninst:
    ClearErrors
    ExecWait '$R0 _?=$INSTDIR'
    
    IfErrors no_remove_uninstaller done
    no_remove_uninstaller:
    
    done:
FunctionEnd

; Function to handle finish page link
Function MUI_FINISHPAGE_SHOW
    ${NSD_CreateLink} 120u 240u 100% 12u "Visit EvolveAI on GitHub"
    Pop $0
    ${NSD_OnClick} $0 openGitHub
FunctionEnd

Function openGitHub
    ExecShell "open" "https://github.com/WulfForge/EvolveAI"
FunctionEnd 