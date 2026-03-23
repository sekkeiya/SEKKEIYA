# Firestore ER Diagram (Advanced)

```mermaid
erDiagram

    USERS ||--o{ MY_BOARDS : owns
    USERS ||--o{ TEAM_BOARDS : member
    USERS ||--o{ MODELS : owns

    MY_BOARDS ||--o{ BOARD_MODELS : contains
    TEAM_BOARDS ||--o{ BOARD_MODELS : contains

    MODELS ||--o{ BOARD_MODELS : referenced

    USERS {
        string userId
        string email
        string plan
        string path: users/{userId}
    }

    MODELS {
        string modelId
        string name
        string visibility
        string ownerId
        string path: users/{userId}/models/{modelId}
    }

    MY_BOARDS {
        string boardId
        string name
        string ownerId
        string path: users/{userId}/myBoards/{boardId}
    }

    TEAM_BOARDS {
        string boardId
        string name
        string members
        string path: teamBoards/{boardId}
    }

    BOARD_MODELS {
        string id
        string modelRef
        string path: */models/{modelId}
    }
```
