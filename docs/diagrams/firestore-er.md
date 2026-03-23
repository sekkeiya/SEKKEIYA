
---

# 2. firestore-er.md

```md
# Firestore ER Diagram

```mermaid
erDiagram

    USERS ||--o{ MY_BOARDS : owns
    USERS ||--o{ TEAM_BOARDS : member
    USERS ||--o{ MODELS : owns

    MY_BOARDS ||--o{ BOARD_MODEL_REFS : contains
    TEAM_BOARDS ||--o{ BOARD_MODEL_REFS : contains

    MODELS ||--o{ BOARD_MODEL_REFS : referenced

    USERS {
        string userId
        string email
        string plan
        string path_users_userId
    }

    MY_BOARDS {
        string boardId
        string name
        string ownerId
        string path_myBoards
    }

    TEAM_BOARDS {
        string boardId
        string name
        array members
        string path_teamBoards
    }

    MODELS {
        string modelId
        string name
        string visibility
        string ownerId
        string path_users_models
    }

    BOARD_MODEL_REFS {
        string id
        string modelRef
        string path_models_subcollection
    }
