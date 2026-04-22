# SixD Access Chart

This access model uses two layers:

1. Default access comes from the user's role.
2. Exceptions can be applied per user with `permissionGrants` and `permissionRevokes`.

## Role hierarchy

1. `MD`
2. `CFO`
3. `BUSINESS_HEAD`
4. `ACCOUNTS`
5. `BUSINESS_MANAGER`
6. `BD_TEAM`
7. `SALES_TEAM`
8. `FIELD_ENGINEER`

## High-value controls

| Permission key | Meaning |
|---|---|
| `team:edit_access` | Change login access, reset password or PIN, activate or deactivate a user |
| `team:assign_roles` | Change a user's role assignment |
| `team:assign_permissions` | Give or remove custom permission exceptions for one user |
| `invoice:initiate` | Add bills or create invoice drafts from project work |
| `invoice:review` | Review bills before approval |
| `invoice:approve` | Approve bills for dispatch |
| `invoice:send` | Mark approved bills as dispatched to the client |
| `payment:record` | Enter payment receipts against invoices |
| `planning:assign_team` | Assign engineers to projects |
| `planning:assign_equipment` | Assign equipment to projects |
| `planning:manage_travel` | Coordinate travel and mobilisation planning |

## Role matrix

| Role | Core ownership | Key permissions |
|---|---|---|
| `MD` | Full platform control | All permissions |
| `CFO` | Financial oversight | `invoice:view_all`, `payment:view`, `project:view_all`, `audit:view` |
| `BUSINESS_HEAD` | Cross-functional operations control | `project:manage`, `planning:*`, `team:manage`, `team:edit_access`, `team:assign_roles`, `invoice:initiate` |
| `ACCOUNTS` | Billing and collections execution | `invoice:view_all`, `invoice:review`, `invoice:approve`, `invoice:send`, `invoice:edit`, `payment:record` |
| `BUSINESS_MANAGER` | Delivery and account ownership | `project:create`, `project:view_own`, `project:manage`, `planning:*`, `expense:approve`, `invoice:initiate`, `invoice:edit`, `compliance:manage` |
| `BD_TEAM` | Client development and PO intake | `client:view`, `client:manage`, `po:create`, `po:view_own` |
| `SALES_TEAM` | Commercial pipeline support | `client:view`, `po:create`, `po:view_own` |
| `FIELD_ENGINEER` | Field execution | `logsheet:submit`, `logsheet:view_own`, `expense:submit` |

## Long-term pattern

Use roles for the default operating model, then use per-user overrides only for exceptions.

Examples:

| Scenario | Recommended setup |
|---|---|
| A Business Manager should also be able to edit one user's access | Keep role as `BUSINESS_MANAGER`, add `team:edit_access` to `permissionGrants` |
| A Business Head should not approve bills | Keep role as `BUSINESS_HEAD`, add `invoice:approve` to `permissionRevokes` |
| A Sales Team user needs temporary bill creation rights | Keep role as `SALES_TEAM`, add `invoice:initiate` to `permissionGrants` |

This avoids creating one-off roles for every exception and keeps the hierarchy stable.
