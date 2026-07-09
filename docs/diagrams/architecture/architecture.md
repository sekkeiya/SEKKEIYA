# SEKKEIYA Core Architecture Concept

The SEKKEIYA ecosystem is built on a strict hierarchical structure, treating the **Project** as the Single Source of Truth and the ultimate final deliverable (1 Project = 1 Website). The ecosystem is no longer a collection of isolated apps or "Boards", but a unified suite of tools designed to construct specific sections of the Project Website.

```mermaid
flowchart TD
    %% Class Definitions
    classDef user fill:#e1f5fe,stroke:#4fc3f7,stroke-width:2px,color:#01579b
    classDef sekkeiya fill:#e3f2fd,stroke:#64b5f6,stroke-width:2px,color:#0d47a1
    classDef project fill:#2c3e50,stroke:#34495e,stroke-width:2px,color:#fff
    classDef section fill:#27ae60,stroke:#2ecc71,stroke-width:2px,color:#fff
    classDef item fill:#f39c12,stroke:#f1c40f,stroke-width:2px,color:#fff
    classDef asset fill:#7f8c8d,stroke:#95a5a6,stroke-width:2px,color:#fff
    classDef ai fill:#8e44ad,stroke:#9b59b6,stroke-width:2px,color:#fff
    classDef mode fill:#d35400,stroke:#e67e22,stroke-width:2px,color:#fff
    
    %% Node Definitions
    User[User]:::user
    Sekkeiya[SEKKEIYA<br>AI Orchestration & Generation Layer]:::sekkeiya
    Proj[Project<br>Final Website Deliverable]:::project
    
    S_Lan[Landing]:::section
    S_Mod[Models]:::section
    S_Draw[Drawings]:::section
    S_Ren[Renders]:::section
    S_Mov[Movies]:::section
    S_Art[Articles]:::section
    S_Sli[Slides]:::section
    S_Ana[Analysis]:::section
    
    Item_A[Asset / Data]:::asset
    Item_B[Asset / Data]:::asset
    
    AID[AI Drive<br>Context Aggregator]:::ai
    AIC[AI Chat<br>Navigator & Engine]:::ai

    M_Edit[Edit Mode]:::mode
    M_Int[Internal View]:::mode
    M_Pub[Public View<br>/p/:slug]:::mode

    %% Connections
    User --> Sekkeiya
    Sekkeiya --> Proj
    
    Proj --> S_Lan
    Proj --> S_Mod
    Proj --> S_Draw
    Proj --> S_Ren
    Proj --> S_Mov
    Proj --> S_Art
    Proj --> S_Sli
    Proj --> S_Ana
    
    S_Mod -.->|Displays| Item_A
    S_Draw -.->|Displays| Item_B
    
    Proj -.->|Provides Ultimate Context| AID
    AID --> AIC
    AIC -.->|Builds Project Website| Proj
    
    Proj --- M_Edit
    Proj --- M_Int
    Proj --- M_Pub
```

## Key Concepts
1. **SEKKEIYA**: Project Generation & AI Orchestration layer. It is not just a portal, but the OS that builds the Project.
2. **Project (最終成果物)**: Single Source of Truth, representing a complete Web Site. The ultimate boundary for access control, team membership, requirements metadata, and AI context. It supports Edit Mode, Internal View, and Public View.
3. **Section (出力先)**: Sub-directories of the Project Website (Landing, Models, Drawings, Renders, Movies, Articles, Slides, Analysis). Child apps act purely as generation tools targeting these sections.
4. **Asset (実体データ)**: The physical 3D model, image, or document stored in the cloud.
5. **AI**: The engine that drives the completion of the Project Page. AI Chat is the navigator, and AI Drive is the contextual memory.
