# 数据中心迁移通告（含流程图）

**发布时间**：2026-05-28  
**影响范围**：核心业务系统、报表服务

## 操作流程

1. 发布迁移通告并通知相关团队
2. 确认业务方完成数据备份
3. 停止应用写入服务
4. 同步数据库至目标机房
5. 数据同步是否完成？
6. 完成则在 B 机房启动服务
7. 执行冒烟测试
8. 测试是否通过？
9. 通过则切换流量至新机房
10. 未通过则回滚至 A 机房
11. 发送迁移完成通知

## 流程图

```mermaid
flowchart TD
    n0["数据中心迁移通告"]
    class n0 titleNode
    n1["操作流程"]
    class n1 sectionNode
    n0 --> n1
    n2["发布迁移通告并通知相关团队"]
    n1 --> n2
    n3["确认业务方完成数据备份"]
    n2 --> n3
    n4["停止应用写入服务"]
    n3 --> n4
    n5["同步数据库至目标机房"]
    n4 --> n5
    n6{"数据同步是否完成？"}
    class n6 decisionNode
    n5 --> n6
    n7["完成则在 B 机房启动服务"]
    n6 --> n7
    n8["执行冒烟测试"]
    n7 --> n8
    n9{"测试是否通过？"}
    class n9 decisionNode
    n8 --> n9
    n10["通过则切换流量至新机房"]
    n9 --> n10
    n11["未通过则回滚至 A 机房"]
    n10 --> n11
    n12["发送迁移完成通知"]
    n11 --> n12
    classDef titleNode fill:#4f8cff,color:#fff,stroke:#3a6fd8
    classDef sectionNode fill:#eef3ff,color:#1a1f2e,stroke:#4f8cff
    classDef decisionNode fill:#fff3cd,color:#1a1f2e,stroke:#f0ad4e
```
