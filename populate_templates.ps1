$appTemplate = @"
# {0}

## 役割

## 主な画面

## 主に扱う Item / Asset

## 読むデータ

## 書くデータ

## Project / Board との関係

## AI Drive との関係

## AI Chat との関係

## 公開 / 非公開の扱い

## 将来の責務境界
"@

$apps = @(
    @("3DSS", "docs/specs/apps/3dss.md"),
    @("3DSL", "docs/specs/apps/3dsl.md"),
    @("3DSP", "docs/specs/apps/3dsp.md"),
    @("3DSC", "docs/specs/apps/3dsc.md"),
    @("3DSB", "docs/specs/apps/3dsb.md"),
    @("3DSQ", "docs/specs/apps/3dsq.md")
)

foreach ($app in $apps) {
    if (-not (Test-Path -Path $app[1])) {
        $content = $appTemplate -f $app[0]
        Set-Content -Path $app[1] -Value $content -Encoding UTF8
        Write-Host "Created template for $($app[0])"
    }
}

$projectBoardArch = @"
# Project / Board Architecture

## 目的

## 基本概念

## Project の責務

## Board の責務

## Item の責務

## Asset の責務

## 子アプリとの関係

## 今後の拡張方針
"@
if (-not (Test-Path -Path "docs/specs/architecture/project-board-architecture.md")) {
    Set-Content -Path "docs/specs/architecture/project-board-architecture.md" -Value $projectBoardArch -Encoding UTF8
}

$appResp = @"
# App Responsibility Map

"@
if (-not (Test-Path -Path "docs/specs/architecture/app-responsibility-map.md")) {
    Set-Content -Path "docs/specs/architecture/app-responsibility-map.md" -Value $appResp -Encoding UTF8
}

$sourceOfTruth = @"
# Firestore Source of Truth

## 目的

## 正規コレクション

## 廃止済み構造

## Board 関連の正規パス

## 子アプリが従うべきルール

## 今後追加する際の原則
"@
if (-not (Test-Path -Path "docs/specs/data/firestore_source_of_truth.md")) {
    Set-Content -Path "docs/specs/data/firestore_source_of_truth.md" -Value $sourceOfTruth -Encoding UTF8
}

$inventory = @"
# Firestore Inventory
"@
if (-not (Test-Path -Path "docs/specs/data/firestore_inventory.md")) {
    Set-Content -Path "docs/specs/data/firestore_inventory.md" -Value $inventory -Encoding UTF8
}

Write-Host "All specified priority templates have been generated."
