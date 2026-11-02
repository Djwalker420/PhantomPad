$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Get-LatestSetup([string]$Repository, [string]$Pattern, [string]$Destination) {
    $release = Invoke-RestMethod -Headers @{ 'User-Agent' = 'PhantomPad-Installer' } -Uri "https://api.github.com/repos/$Repository/releases/latest"
    $asset = $release.assets | Where-Object { $_.name -match $Pattern } | Select-Object -First 1
    if (-not $asset -or ([uri]$asset.browser_download_url).Host -ne 'github.com') {
        throw "No official setup asset matching $Pattern was found in $Repository's latest release."
    }

    $Destination += [IO.Path]::GetExtension($asset.name)
    Invoke-WebRequest -Headers @{ 'User-Agent' = 'PhantomPad-Installer' } -Uri $asset.browser_download_url -OutFile $Destination
    if ($asset.digest -and $asset.digest -match '^sha256:(.+)$') {
        $actual = (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -ne $Matches[1].ToLowerInvariant()) { throw "The downloaded $($asset.name) did not match GitHub's release digest." }
    }
    return $Destination
}

function Install-Setup([string]$Path) {
    if ([IO.Path]::GetExtension($Path) -ieq '.msi') {
        $process = Start-Process -FilePath "$env:SystemRoot\System32\msiexec.exe" -ArgumentList @('/i', "`"$Path`"") -Wait -PassThru
    } else {
        $process = Start-Process -FilePath $Path -Wait -PassThru
    }
    if ($process.ExitCode -notin @(0, 3010, 1641)) { throw "Driver installer returned exit code $($process.ExitCode)." }
}

try {
    $temporary = Join-Path $env:TEMP ('PhantomPadDrivers-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $temporary | Out-Null

    if (-not (Test-Path 'HKLM:\SYSTEM\CurrentControlSet\Services\ViGEmBus')) {
        $setup = Get-LatestSetup 'nefarius/ViGEmBus' 'ViGEmBus.*\.(exe|msi)$' (Join-Path $temporary 'vigem-setup')
        Install-Setup $setup
    }
    if (-not (Test-Path 'HKLM:\SYSTEM\CurrentControlSet\Services\vjoy')) {
        $setup = Get-LatestSetup 'jshafer817/vJoy' 'vjoy.*setup.*\.exe$' (Join-Path $temporary 'vjoy-setup.exe')
        Install-Setup $setup
    }

    if (-not (Test-Path 'HKLM:\SYSTEM\CurrentControlSet\Services\ViGEmBus') -or
        -not (Test-Path 'HKLM:\SYSTEM\CurrentControlSet\Services\vjoy')) {
        throw 'Windows did not register both required driver services after installation.'
    }
    Remove-Item -LiteralPath $temporary -Recurse -Force
    exit 0
} catch {
    Write-Error $_
    exit 1
}
