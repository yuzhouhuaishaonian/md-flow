# Data Center Migration Notice (with Flowchart)

**Release time**: 2026-05-28  
**Affected scope**: Core business systems, reporting services

## Operation Flow

1. Publish the migration notice and notify related teams
2. Confirm the business side has completed data backup
3. Stop the application write service
4. Sync the database to the target data center
5. Is the data sync complete?
6. If complete, start the service in Data Center B
7. Run a smoke test
8. Did the test pass?
9. If passed, switch traffic to the new data center
10. If not passed, roll back to Data Center A
11. Send the migration completion notice

## Flowchart

```mermaid
flowchart TD
    n0["Data Center Migration Notice"]
    class n0 titleNode
    n1["Operation Flow"]
    class n1 sectionNode
    n0 --> n1
    n2["Publish the migration notice and notify related teams"]
    n1 --> n2
    n3["Confirm the business side has completed data backup"]
    n2 --> n3
    n4["Stop the application write service"]
    n3 --> n4
    n5["Sync the database to the target data center"]
    n4 --> n5
    n6{"Is the data sync complete?"}
    class n6 decisionNode
    n5 --> n6
    n7["If complete, start the service in Data Center B"]
    n6 --> n7
    n8["Run a smoke test"]
    n7 --> n8
    n9{"Did the test pass?"}
    class n9 decisionNode
    n8 --> n9
    n10["If passed, switch traffic to the new data center"]
    n9 --> n10
    n11["If not passed, roll back to Data Center A"]
    n10 --> n11
    n12["Send the migration completion notice"]
    n11 --> n12
    classDef titleNode fill:#4f8cff,color:#fff,stroke:#3a6fd8
    classDef sectionNode fill:#eef3ff,color:#1a1f2e,stroke:#4f8cff
    classDef decisionNode fill:#fff3cd,color:#1a1f2e,stroke:#f0ad4e
```
