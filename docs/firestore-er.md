# Firestore ER Diagram

```mermaid
erDiagram

    USERS ||--o{ MY_BOARDS : owns
    USERS ||--o{ TEAM_BOARDS : joins
    USERS ||--o{ MODELS : owns

    MY_BOARDS ||--o{ BOARD_MODELS : contains
    TEAM_BOARDS ||--o{ BOARD_MODELS : contains

    MODELS ||--o{ BOARD_MODELS : referenced

    USERS {
        string userId
        string email
        string plan
    }

    MODELS {
        string modelId
        string name
        string visibility
        string ownerId
    }

    MY_BOARDS {
        string boardId
        string name
        string ownerId
    }

    TEAM_BOARDS {
        string boardId
        string name
        string members
    }

    BOARD_MODELS {
        string id
        string modelRef
    }
```
