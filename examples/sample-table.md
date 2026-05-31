# users Table Example

A demo user table used to test SQL -> erDiagram auto conversion.

```sql
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL COMMENT 'login name',
  `email` varchar(100) NOT NULL COMMENT 'user email',
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT 'active / inactive',
  `role` varchar(20) NOT NULL DEFAULT 'member' COMMENT 'admin / member',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `users_idx_email` (`email`) USING BTREE,
  KEY `users_idx_status_role` (`status`, `role`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Demo user table for diagram preview';
```
