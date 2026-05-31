# Data Center Migration Notice

**Release time**: 2026-05-28  
**Affected scope**: Core business systems, reporting services  
**Estimated duration**: 4 hours  
**Owner**: Ops Department · John

## Background

Due to a data center equipment upgrade, the production environment needs to be migrated from Data Center A to Data Center B. Some services may be temporarily unavailable during the migration.

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

## Notes

- The migration window is Saturday 02:00–06:00, please do not schedule changes
- For urgent business needs, contact the on-call staff in advance
- The rollback decision must be made within 30 minutes

## Contacts

| Role | Name | Phone |
|------|------|-------|
| Ops on-call | John | 138-xxxx-xxxx |
| Business liaison | Mike | 139-xxxx-xxxx |

> If you have any questions, please email ops@example.com
