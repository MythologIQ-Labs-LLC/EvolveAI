param(
    [string]$ContentHash,
    [string]$PreviousHash
)

$content = $ContentHash + $PreviousHash
$bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
$sha256 = [System.Security.Cryptography.SHA256]::Create()
$hash = $sha256.ComputeHash($bytes)
[System.BitConverter]::ToString($hash).Replace('-','').ToLower()
