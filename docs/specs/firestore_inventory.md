# Firestore Architecture & Inventory

This document outlines the current state of the Firestore database across the SEKKEIYA / 3DSS / 3DSL ecosystem, mapping out the Single Source of Truth (SSOT) versus derived indexes and legacy collections.

## 1. Top-Level Collections Overview

### users
The core collection containing user profiles and all their personally owned data in subcollections.
- `users/{uid}/models`: **(SSOT)** The canonical source for user-uploaded 3D models.
- `users/{uid}/appPreferences`: User-specific app settings and preferences.
- `users/{uid}/driveFolders`: User's virtual folder structure for the AI Drive feature.
- `users/{uid}/driveAssets`: **(Derived Index)** Automatically synchronized copies of `models` and other assets for the AI Drive search ecosystem.
- `users/{uid}/chatThreads`: Conversation threads associated with the user.
- `users/{uid}/following` / `followers`: Social graph data.

### boards (Unified Schema v2)
The new, unified source of truth for all types of boards (My Boards, Team Boards, etc.).
- `boards/{boardId}`: **(SSOT)** Board metadata. Contains `boardType` ("myBoards" or "teamBoards") and `visibility` ("public" or "private").
- `boards/{boardId}/items/{itemId}`: **(SSOT)** References to the actual content (models, images, notes) within a board.

### Derived Public Indexes
These collections are automatically maintained (often by Cloud Functions or trigger scripts) to facilitate fast public searching without exposing private data or doing complex queries on deep subcollections.
- `publicModelIndex`: **(Derived Index)** Read-optimized copies of `users/{uid}/models` where `visibility === "public"`. Used extensively by 3DSS search.
- `boardsPublic`: **(Derived Index)** Publicly visible mirrors of `boards` items.
- `usernames`: Fast lookup index for unique handles/usernames.
- `tags` / `brandTags`: Aggregated taxonomy data for quick filtering.

### System & Social Collections
- `teamBoardInvitations`: Management of pending, accepted, and declined invites.
- `chats`: Global chat threads.
- `plans`: Subscription and tier definitions.
- `officialArticles`: SEKKEIYA published content.
- `projects`: Part of the Phase 6 migration strategy for grouping work.

---

## 2. Legacy and Deprecated Collections (Cleanup Targets)

The following paths represent older data structures that have been superseded by the Unified Schema v2 (`boards`).

### Legacy MyBoards
- `users/{uid}/myBoards`: Originally held the board metadata. Should now be empty or merely links, but older data may still reside here.
- `users/{uid}/myBoards/{boardId}/models`: Originally held the models inside a personal board. Superseded by `boards/{boardId}/items`.

### Legacy TeamBoards
- `teamBoards`: The old global collection for team boards. Superseded by `boards` (with `boardType: "teamBoards"`).
- `teamBoards/{boardId}/models`: The models inside the old team board structure. Superseded by `boards/{boardId}/items`.
- `users/{uid}/teamBoards`: User-specific links to `teamBoards`. 

---

## 3. Data Synchronization Flow

1. **Models to driveAssets**
   - **Trigger:** Cloud Function `onUserModelsWritten` (`sekkeiya/functions/models/sync.js`).
   - **Action:** Any write/delete to `users/{uid}/models/{modelId}` creates/updates/soft-deletes `users/{uid}/driveAssets/asset-3dss-{modelId}`.

2. **Models to publicModelIndex**
   - **Trigger:** Client-side API hooks (`r3dm-share/src/shared/api/models/crud/publicIndexSync.js` or equivalent Cloud Functions).
   - **Action:** Upon saving a model with `visibility === "public"`, a mapped projection of the model data is written to `publicModelIndex`. Changing visibility to "private" deletes the index document.

3. **Boards to boardsPublic**
   - **Trigger:** Handled during board creation/update or via background sync.
   - **Action:** Publicly accessible team boards are mirrored here for discovery.
