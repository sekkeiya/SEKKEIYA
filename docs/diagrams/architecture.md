# SEKKEIYA Core Architecture Concept

The SEKKEIYA ecosystem is built on a strict hierarchical structure, clearly separating contexts, workspaces, and data pointers.

```mermaid
flowchart TD
    %% Class Definitions
    classDef user fill:#e1f5fe,stroke:#4fc3f7,stroke-width:2px,color:#01579b
    classDef sekkeiya fill:#e3f2fd,stroke:#64b5f6,stroke-width:2px,color:#0d47a1
    classDef project fill:#2c3e50,stroke:#34495e,stroke-width:2px,color:#fff
    classDef board fill:#27ae60,stroke:#2ecc71,stroke-width:2px,color:#fff
    classDef item fill:#f39c12,stroke:#f1c40f,stroke-width:2px,color:#fff
    classDef asset fill:#7f8c8d,stroke:#95a5a6,stroke-width:2px,color:#fff
    classDef ai fill:#8e44ad,stroke:#9b59b6,stroke-width:2px,color:#fff
    
    %% Node Definitions
    User[User]:::user
    Sekkeiya[SEKKEIYA Ecosystem]:::sekkeiya
    Proj[Project<br>Single Source of Truth & Auth]:::project
    
    B_Mod[Models Board<br>3DSS Workspace]:::board
    B_Lay[Layout Board<br>3DSL Workspace]:::board
    B_Pre[Presents Board<br>3DSP Workspace]:::board
    
    Item_A[Item<br>Pointer]:::item
    Item_B[Item<br>Pointer]:::item
    
    Asset_A[Asset<br>Actual Data File/Metadata]:::asset
    Asset_B[Asset<br>Actual Data File/Metadata]:::asset
    
    AID[AI Drive<br>Context Aggregator]:::ai
    AIC[AI Chat<br>Action Engine]:::ai

    %% Connections
    User --> Sekkeiya
    Sekkeiya --> Proj
    
    Proj --> B_Mod
    Proj --> B_Lay
    Proj --> B_Pre
    
    B_Mod --> Item_A
    B_Lay --> Item_B
    
    Item_A -->|References| Asset_A
    Item_B -->|References| Asset_B
    
    Proj -.->|Provides Context| AID
    AID --> AIC
    AIC -.->|Multi-step Action| Proj
```

## Key Concepts
1. **Project (世界/文脈)**: The ultimate boundary for access control, team membership, and AI context.
2. **Board (作業領域)**: A dedicated workspace for a specific child app (`appScope`).
3. **Item (参照ポインタ)**: A lightweight JSON object existing inside a Board, pointing to the real data.
4. **Asset (実体)**: The physical 3D model, image, or document stored in the user's root storage or public space.
