flowchart TD
    %% Styling for Actors
    classDef initiator fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
    classDef dept fill:#fff3e0,stroke:#e65100,stroke-width:2px;
    classDef linkages fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px;
    classDef legal fill:#f3e5f5,stroke:#4a148c,stroke-width:2px;
    classDef exec fill:#ffebee,stroke:#b71c1c,stroke-width:2px;
    classDef mne fill:#e0f7fa,stroke:#006064,stroke-width:2px;
    classDef dash fill:#eceff1,stroke:#263238,stroke-width:2px;

    Start((Start)) --> I1

    subgraph Phase 1: Initiation
        I1[Researcher / Initiator: <br>Search Partners & View Checklist]:::initiator --> I2
        I2[Researcher / Initiator: <br>Submit MoU, CRA, CA Request]:::initiator
    end

    subgraph Phase 2: Workflow Approvals
        I2 --> A1{Dept / Faculty Approver: <br>Review Academic Fit}:::dept
        A1 -- Return for Correction --> I2
        A1 -- Approve --> A2{Linkages Officer: <br>Review Strategic Fit}:::linkages
        A2 -- Return for Correction --> I2
        A2 -- Approve --> A3{Legal Reviewer: <br>Drafting & Clause Vetting}:::legal
        A3 -- Request Revisions --> A2
    end

    subgraph Phase 3: Validation & Activation
        A3 -- Approve Draft --> E1[VC Office / Partner CEO: <br>Signing & Ceremony]:::exec
        E1 --> E2[Linkages Officer: <br>Upload Final Signed PDF & Activate]:::linkages
    end

    subgraph Phase 4: Monitoring & Evaluation
        E2 --> M1[Internal Champion / M&E Officer: <br>Track Outputs & Attach Evidence]:::mne
        M1 --> M2{Linkages Director / Champion: <br>Renewal, Closure, or Archive}:::linkages
        M2 -- Renew/Extend --> M1
    end

    %% Executive Dashboard Oversight
    Dash[Executive KPI Dashboard: <br>Oversight by DVC RPE & Leadership]:::dash
    E2 -. Active Agreements Data .-> Dash
    M1 -. M&E Performance Data .-> Dash