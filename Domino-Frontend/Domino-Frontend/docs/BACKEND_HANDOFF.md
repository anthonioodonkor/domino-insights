# Replacement backend handoff

The frontend no longer imports a database SDK or generated bindings. It runs in local preview mode while a separate backend is developed.

## Integration boundary

Implement the `DominoState` and `DominoActions` contracts in `src/lib/types.ts`, and replace the preview provider in `src/lib/connection.tsx`. Pages already use `useDomino()` and should not need to know the transport or database implementation.

The provider supplies a `Portfolio` snapshot, authenticated identity/member, connection state, async actions, and a reconnect callback. Use `connecting` until the initial data arrives, `live` only for an established backend connection, and `disconnected` or `error` on interruption. `preview` is reserved for the local mock adapter.

## Data expected by the UI

Buildings, zones, assets, sensor readings, maintenance tickets, occupancy snapshots, incidents, incident events, proposals, and team members are typed in `src/lib/types.ts`. IDs are plain strings, timestamps are epoch milliseconds, and monetary values are numeric USD estimates.

Preserve building/zone/asset and incident/proposal/event relationships. Return parsed `evidence`, `assumptions`, and `impact` objects rather than serialized JSON fields. Risk scores, data quality, and financial estimates should come from the new backend's authoritative calculations.

## Commands

The UI expects registration, scenario injection, seed/reset, acknowledgment, assignment, response proposal, approval/rejection, resolution, and assumption updates. Actions return promises that reject with user-readable errors. Supply fresh state after successful actions, including changes made by other users when multi-user operation is implemented.

Approval includes `expectedRevision` so the backend can reject stale financial reviews. Increment proposal revision when assumptions change. Preserve lifecycle rules, lock approved financial terms, and generate attributable event records on the server. Enforce manager-only approval and demo controls on the server; hiding buttons is not authorization.

## Preview limitations

The sample manager is not an authenticated account. The sample engineer exists only for assignment demonstrations. There is no network, storage, subscription, role provisioning, or security boundary in the preview adapter. Reloading starts a fresh fixture. Remove `src/lib/preview/` when the real adapter is ready.

Update preview-specific copy in App and the incident/overview pages when enabling the backend. Remove the local preview notice only when the provider actually connects to the replacement service.
