param(
  [string]$ConnectionString = "postgresql://postgres:Levanluong18%40@db.hblehvnhxkanvyaksaux.supabase.co:5432/postgres?sslmode=require",
  [string]$SqlFile = "backup_small_credit_supabase_ready.sql"
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $SqlFile)) {
  throw "Không tìm thấy file SQL: $SqlFile"
}

if (Get-Command psql -ErrorAction SilentlyContinue) {
  Write-Host "Đang import bằng psql..."
  & psql $ConnectionString -v ON_ERROR_STOP=1 -f $SqlFile
}
else {
  Write-Host "psql chưa cài, đang dùng Docker image postgres để import..."
  docker run --rm -v "${PWD}:/work" -w /work postgres:16 psql $ConnectionString -v ON_ERROR_STOP=1 -f $SqlFile
}
