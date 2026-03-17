param([string]$Path = "src")

$allContent = ""
Get-ChildItem -Path $Path -Recurse -Filter "*.ts" | Sort-Object FullName | ForEach-Object {
    $allContent += Get-Content $_.FullName -Raw
}

$bytes = [System.Text.Encoding]::UTF8.GetBytes($allContent)
$sha256 = [System.Security.Cryptography.SHA256]::Create()
$hash = $sha256.ComputeHash($bytes)
[System.BitConverter]::ToString($hash).Replace('-','').ToLower()
