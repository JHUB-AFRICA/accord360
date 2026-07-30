# Accord 360 v1.2 — Role-Based Workspace Release

## Problem corrected

Previously, every user landed on the same generic dashboard even though backend data was partly scoped. The interface did not clearly represent the responsibilities of Champions, Approvers, Linkages, Legal, DVC RPE, VC Office, M&E, Executives, Administrators and Auditors.

## Changes

- Added a unique home route and workspace for every role.
- Redirected login to the authenticated user's assigned workspace.
- Added role-specific navigation menus, headers, KPI cards, action queues, instructions and primary actions.
- Added route guards so users cannot open pages that are not assigned to their role.
- Added DVC RPE and VC Office roles and demo accounts.
- Added the mandatory Legal → DVC RPE → VC Office workflow gates.
- Removed administrator authority to perform business approvals.
- Added VC Office signing-date editing and official signed-document permissions.
- Added role-scoped dashboard queues and metrics from the API.
- Added sample records in department approval, Legal, DVC, VC signing and M&E stages so each demo role has a meaningful workspace.
- Added automated tests covering all workspace definitions and end-to-end separation of workflow duties.

## Verification

- Backend test suite: 10 passed.
- Python compilation: passed.
- Frontend JS/JSX syntax parsing: passed.
- A production Vite build could not run in the packaging environment because its internal npm mirror does not contain the pinned Vite package. The package lock uses normal package metadata and should install from a standard npm registry.
