#ifndef MyAppVersion
  #define MyAppVersion "0.0.0"
#endif

#define MyAppName "SchedulePin Helper"
#define MyAppPublisher "SchedulePin"
#define MyAppExeName "schedulepin-helper.exe"
#define NativeHostName "com.schedulepin.helper"

[Setup]
AppId={{A15C4D8F-1E17-4ED4-93B9-D37B88A71C52}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\SchedulePin Helper
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\release\local
OutputBaseFilename=SchedulePin-Helper-Setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
SetupLogging=yes
CloseApplications=force
RestartApplications=no
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\{#MyAppExeName}
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription=SchedulePin Windows wallpaper helper installer
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}

[Files]
Source: "..\native-helper\target\release\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion restartreplace
Source: "com.schedulepin.helper.json"; DestDir: "{app}"; Flags: ignoreversion

[Registry]
Root: HKCU; Subkey: "Software\Google\Chrome\NativeMessagingHosts\{#NativeHostName}"; ValueType: string; ValueName: ""; ValueData: "{app}\com.schedulepin.helper.json"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Microsoft\Edge\NativeMessagingHosts\{#NativeHostName}"; ValueType: string; ValueName: ""; ValueData: "{app}\com.schedulepin.helper.json"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "SchedulePinHelper"; ValueData: """{app}\{#MyAppExeName}"" --daemon"; Flags: uninsdeletevalue

[Run]
Filename: "{app}\{#MyAppExeName}"; Parameters: "--daemon"; Flags: nowait runhidden

[Code]
var
  RestoreSucceeded: Boolean;

procedure StopHelper();
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM {#MyAppExeName}', '', SW_HIDE,
    ewWaitUntilTerminated, ResultCode);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  StopHelper();
  Result := '';
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  DataDir: String;
  HelperPath: String;
  ResultCode: Integer;
begin
  DataDir := ExpandConstant('{localappdata}\SchedulePin');
  HelperPath := ExpandConstant('{app}\{#MyAppExeName}');

  if CurUninstallStep = usUninstall then
  begin
    RestoreSucceeded := not DirExists(DataDir);
    StopHelper();

    if FileExists(HelperPath) then
    begin
      RestoreSucceeded := Exec(HelperPath, '--restore', '', SW_HIDE,
        ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
      if not RestoreSucceeded then
        MsgBox('The original wallpaper could not be restored. SchedulePin data and wallpaper backups will be kept.',
          mbError, MB_OK);
    end
    else if DirExists(DataDir) then
      MsgBox('The helper executable is missing. SchedulePin data and wallpaper backups will be kept.',
        mbError, MB_OK);
  end
  else if (CurUninstallStep = usPostUninstall) and RestoreSucceeded then
  begin
    DelTree(DataDir, True, True, True);
  end;
end;
