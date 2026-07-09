# Create Directories
$dirs = @(
    "docs/diagrams/architecture",
    "docs/diagrams/data",
    "docs/diagrams/flows",
    "docs/diagrams/apps",
    "docs/specs/architecture",
    "docs/specs/data",
    "docs/specs/apps",
    "docs/specs/flows",
    "docs/specs/setup"
)

foreach ($dir in $dirs) {
    if (-not (Test-Path -Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
        Write-Host "Created $dir"
    }
}

# Move existing files to target destinations where obvious
$moves = @(
    # diagrams/architecture
    @("docs/diagrams/architecture.md", "docs/diagrams/architecture/architecture.md"),
    @("docs/diagrams/core-system-map.md", "docs/diagrams/architecture/core-system-map.md"),
    @("docs/diagrams/final-system-map.md", "docs/diagrams/architecture/final-system-map.md"),
    @("docs/diagrams/responsibility-map.md", "docs/diagrams/architecture/responsibility-map.md"),
    @("docs/diagrams/project-app-scope-map.md", "docs/diagrams/architecture/project-app-scope-map.md"),
    
    # diagrams/data
    @("docs/diagrams/firestore-er.md", "docs/diagrams/data/firestore-er.md"),
    @("docs/diagrams/project-board-er.md", "docs/diagrams/data/project-board-er.md"),
    @("docs/diagrams/ai-context-map.md", "docs/diagrams/data/ai-context-map.md"),
    @("docs/diagrams/user-social-map.md", "docs/diagrams/data/user-social-map.md"),
    
    # diagrams/flows
    @("docs/diagrams/data-flow.md", "docs/diagrams/flows/data-flow.md"),
    @("docs/diagrams/project-board-flow.md", "docs/diagrams/flows/project-board-flow.md"),
    
    # specs/architecture
    @("docs/firebase-architecture.md", "docs/specs/architecture/firebase-architecture.md"),
    @("docs/routing_specs.md", "docs/specs/architecture/routing_specs.md"),
    @("docs/specs/project-board-architecture.md", "docs/specs/architecture/project-board-architecture.md"),
    @("docs/specs/phase10_project_os_plan.md", "docs/specs/architecture/phase10_project_os_plan.md"),
    
    # specs/data
    @("docs/specs/firestore_inventory.md", "docs/specs/data/firestore_inventory.md"),
    @("docs/specs/firestore_cleanup_candidates.md", "docs/specs/data/firestore_cleanup_candidates.md"),
    @("docs/specs/firestore_cleanup_plan.md", "docs/specs/data/firestore_cleanup_plan.md"),
    @("docs/specs/firestore_source_of_truth.md", "docs/specs/data/firestore_source_of_truth.md"),
    
    # specs/setup
    @("docs/emulator-setup.md", "docs/specs/setup/emulator-setup.md")
)

foreach ($move in $moves) {
    $src = $move[0]
    $dst = $move[1]
    if (Test-Path -Path $src) {
        Move-Item -Path $src -Destination $dst -Force
        Write-Host "Moved $src -> $dst"
    } else {
        Write-Host "Source not found: $src (might have been moved already)"
    }
}
Write-Host "Restructuring complete."
