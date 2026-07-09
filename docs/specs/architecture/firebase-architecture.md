# Firebase Infrastructure Architecture

## Project Overview
*   **Firebase Project ID**: `shapeshare3d`
*   **Production Environment**: Consists of multiple frontend applications sharing a single backend infrastructure.

## Infrastructure Ownership

**`sekkeiya` is the CANONICAL SOURCE OF TRUTH for all shared Firebase infrastructure.**

This means that any structural changes to the backend database, storage, or cloud functions *must* originate from the `sekkeiya` repository's codebase and deployment pipeline.

### Permitted Deployment Targets by Repository

*   **`sekkeiya` (Canonical Infrastructure Repo)**
    *   May deploy:
        *   `firestore:rules` (Security rules)
        *   `firestore:indexes` (Composite indexes: `firestore.indexes.json`)
        *   `storage:rules` (Storage security rules)
        *   `functions` (All Cloud Functions)
        *   `hosting` (The Sekkeiya frontend app)
    *   **Deploy Command**: Full `firebase deploy` is allowed, but targeted deploys (e.g., `firebase deploy --only firestore:rules`) are recommended to avoid unintended side effects.

*   **`r3dm-share` (3D Shape Share Web App)**
    *   May deploy: **`hosting` ONLY**
    *   **Deploy Command**: `firebase deploy --only hosting`
    *   *Warning*: This repository's `firebase.json` explicitly excludes non-hosting targets to prevent accidental overwrites of the shared infrastructure.

*   **`3d-shape-layout` (3D Shape Layout App)**
    *   May deploy: **`hosting` ONLY**
    *   **Deploy Command**: `firebase deploy --only hosting`

## Data Architecture & Semantics

The ecosystem relies on clear separation between canonical source data and derived data.

### 1. Canonical Data (Source of Truth)
*   **Path**: `users/{uid}/models/{modelId}`
*   **Role**: This collection is the authoritative record for 3D models. Operations such as sharing, renaming, and privacy toggles act on these documents.
*   **Deletion Semantics**: `isDeleted = true` indicates the canonical model has been soft-deleted by the user.

### 2. Derived Data (Indexed Search Data)
*   **Path**: `users/{uid}/driveAssets/{assetId}`
*   **Role**: This collection serves as a derived, flattened index built specifically for high-speed searching, categorization, and AI embedding (Semantic Search). It unifies "Models," "Images," and other digital assets into the AI Drive view.
*   **Rebuildability**: Data in `driveAssets` must be treated as completely rebuildable at any time from the canonical collections (e.g., via backfill scripts or sync triggers).
*   **Deletion Semantics**: `isDeleted = true` on a `driveAsset` is a *derived index deletion flag*. `driveAssets` must always blindly follow the canonical model state (via `functions/models/sync.js`). If a canonical model is deleted, its corresponding `driveAsset` is marked deleted.

---
**CRITICAL**: *Never* manually edit security rules or indexes from the Firebase console, and never deploy them from any non-canonical repository, as they will be overwritten by `sekkeiya`.
