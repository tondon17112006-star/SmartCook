<#
Chạy các script của dự án bằng Windows Authentication, không cần sqlcmd.
Kết nối mặc định dùng shared memory trên máy hiện tại; không gửi qua TCP.
Không nhận hoặc lưu mật khẩu. Với máy chủ khác, kết nối yêu cầu mã hóa
và chứng chỉ đáng tin cậy. Không thay đổi cấu hình SQL Server.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('schema.sql', 'seed.sql', 'verify.sql', 'migrations/001_weekly_meal_planner.sql')]
    [string]$Script,

    [string]$Server = 'lpc:localhost'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot $Script
if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
    throw "Không tìm thấy script: $scriptPath"
}

$builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$builder['Data Source'] = $Server
$builder['Initial Catalog'] = 'master'
$builder['Integrated Security'] = $true
$builder['Connect Timeout'] = 10
$builder['Application Name'] = 'SmartCook-Database-Scripts'
# Chỉ kết nối shared memory cố định tới máy hiện tại được dùng Encrypt=False.
$builder['Encrypt'] = $Server -notin @('lpc:localhost', 'lpc:.', 'lpc:(local)')
$builder['TrustServerCertificate'] = $false

$connection = New-Object System.Data.SqlClient.SqlConnection $builder.get_ConnectionString()
try {
    $connection.Open()
    $transportCommand = $connection.CreateCommand()
    try {
        $transportCommand.CommandText = "SELECT CAST(CONNECTIONPROPERTY('net_transport') AS nvarchar(40));"
        $transport = $transportCommand.ExecuteScalar()
        if (-not $builder['Encrypt'] -and $transport -ne 'Shared memory') {
            throw 'Kết nối cục bộ không sử dụng shared memory như yêu cầu.'
        }
    } finally { $transportCommand.Dispose() }

    # Các script dự án chỉ dùng GO độc lập trên một dòng; không dùng GO n
    # hoặc chuỗi/comment nhiều dòng chứa một dòng GO.
    $sql = Get-Content -LiteralPath $scriptPath -Raw -Encoding UTF8
    $batches = [regex]::Split($sql, '(?im)^\s*GO\s*(?:--[^\r\n]*)?\r?$')
    $batchNumber = 0
    foreach ($batch in $batches) {
        if ([string]::IsNullOrWhiteSpace($batch)) { continue }
        $batchNumber++
        $command = $connection.CreateCommand()
        $command.CommandTimeout = 120
        $command.CommandText = $batch
        try {
            $reader = $command.ExecuteReader()
            try {
                do {
                    while ($reader.Read()) {
                        $row = [ordered]@{}
                        for ($field = 0; $field -lt $reader.FieldCount; $field++) {
                            $row[$reader.GetName($field)] = if ($reader.IsDBNull($field)) {
                                $null
                            } else { $reader.GetValue($field) }
                        }
                        [pscustomobject]$row | ConvertTo-Json -Depth 4 -Compress
                    }
                } while ($reader.NextResult())
            } finally { $reader.Dispose() }
        } catch {
            $cause = $_.Exception.GetBaseException()
            $location = if ($cause -is [System.Data.SqlClient.SqlException]) {
                ", dòng SQL $($cause.LineNumber), mã $($cause.Number)"
            } else { '' }
            throw "Lỗi $Script, batch ${batchNumber}${location}: $($cause.Message)"
        } finally { $command.Dispose() }
    }
    Write-Output "Hoàn tất $Script ($batchNumber batch)."
} finally { $connection.Dispose() }
