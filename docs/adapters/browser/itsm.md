# ITSM

**Mode**: Browser Bridge · **Domain**: `itsm.segway-ninebot.com`

## Commands

| Command | Description |
|---------|-------------|
| `opencli itsm views` | List workspace views such as all, pending, processing, and done |
| `opencli itsm list` | List tickets from a workspace view, defaulting to processing |
| `opencli itsm show <ticket>` | Show a ticket header/detail summary by number or id |
| `opencli itsm summary` | Summarize pending, processing, and done ticket counts |

## Usage Examples

```bash
opencli itsm views
opencli itsm list --view processing --limit 20
opencli itsm list --view all --query 商城 -f json
opencli itsm show <ticket-number> -f json
opencli itsm summary
```

## Configuration

The adapter reads the tenant and solution from `ITSM_TENANT_ID`,
`ITSM_SOLUTION_ID`, or the query parameters in `ITSM_WORKSPACE_URL`:

```bash
export ITSM_TENANT_ID=<tenant-id>
export ITSM_SOLUTION_ID=<solution-id>
export ITSM_WORKBENCH_LIST_ID=<workbench-list-id>
export ITSM_WORKSPACE_VIEW_ID=<workspace-view-id>
export ITSM_WORKSPACE_QUERY_ID=<workspace-query-id>
export ITSM_DETAIL_VIEW_BY_SOURCE_TABLE='{"T_REQUIREMENT":"<detail-view-id>"}'
export ITSM_ACCESS_TOKEN_COOKIE=<access-token-cookie-name>
export ITSM_TENANT_COOKIE=<tenant-cookie-name>
export ITSM_WORKSPACE_URL='https://itsm.segway-ninebot.com/#/itsm/workspace?...'
```

## Prerequisites

- Chrome running and logged into Segway-Ninebot ITSM
- [Browser Bridge extension](/guide/browser-bridge) installed
- Network access to `itsm.segway-ninebot.com` and `api-itsm.segway-ninebot.com`

## Notes

- `summary` groups only provided status and assignee values. Missing values are
  counted separately in `missingStatusRows` and `missingAssigneeRows`, rather than
  being reported as a status or person named `-`. These counts cover `visibleRows`
  (the inspected page), not all tickets in `total`; a missing assignee value does
  not by itself prove that the ticket is unassigned.
- `show` currently has a verified detail-view mapping for requirement tickets
  (`T_REQUIREMENT`). For other source tables, open the ticket once in the
  browser and pass `--view-id` until the mapping is added.
- The first version is read-only. Workflow actions such as approve, reject,
  comment, or accept should be added as separate write commands with explicit
  safety gates.
