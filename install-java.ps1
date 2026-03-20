$ErrorActionPreference = "Stop"

$jdkUrl = "https://corretto.aws/downloads/latest/amazon-corretto-21-x64-windows-jdk.zip"
$zipPath = "$env:TEMP\corretto.zip"
$extractPath = "$env:TEMP\jdk"

Write-Host "Downloading JDK 21..."
Invoke-WebRequest -Uri $jdkUrl -OutFile $zipPath

Write-Host "Extracting JDK 21..."
if (Test-Path $extractPath) { Remove-Item -Recurse -Force $extractPath }
Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force

$jdkDir = Get-ChildItem -Path $extractPath -Directory | Select-Object -First 1
$binPath = "$($jdkDir.FullName)\bin"

Write-Host "Updating PATH..."
$env:PATH = "$binPath;" + $env:PATH
[Environment]::SetEnvironmentVariable("PATH", $env:PATH, "User")

Write-Host "Java Version:"
java -version

Write-Host "Done! Please restart your terminal to use Java, or use it in the current session."
