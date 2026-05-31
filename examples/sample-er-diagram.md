# users 表示例

erDiagram
    users {
        int id PK "AUTO_INCREMENT"
        varchar username "NOT NULL"
        varchar email UK "NOT NULL"
        varchar status "DEFAULT active"
        varchar role "DEFAULT member"
        datetime created_at "DEFAULT CURRENT_TIMESTAMP"
        timestamp updated_at "ON UPDATE CURRENT_TIMESTAMP"
    }
