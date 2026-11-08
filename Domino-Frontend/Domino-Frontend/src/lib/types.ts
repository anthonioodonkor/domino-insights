export type Role = "engineer" | "manager";
export type Severity = "watch" | "elevated" | "critical";
export type IncidentStatus =
  "watch" | "open" | "acknowledged" | "mitigating" | "resolved";
export type ProposalStatus = "proposed" | "approved" | "rejected";
export interface Building {
  id: string;
  name: string;
  locationLabel: string;
}
export interface Zone {
  id: string;
  buildingId: string;
  name: string;
  capacity: number;
}
export interface Asset {
  id: string;
  buildingId: string;
  zoneId: string;
  name: string;
  assetType: string;
  status: string;
}
export interface SensorReading {
  id: string;
  assetId: string;
  metric: "output_pct" | "temperature_c";
  value: number;
  recordedAt: number;
}
export interface MaintenanceTicket {
  id: string;
  assetId: string;
  summary: string;
  priority: string;
  status: string;
}
export interface OccupancySnapshot {
  id: string;
  zoneId: string;
  people: number;
  recordedAt: number;
}
export interface Evidence {
  source: "telemetry" | "maintenance" | "occupancy";
  label: string;
  detail: string;
  points: number;
}
export interface ImpactInput {
  affectedPeople: number;
  disruptionHours: number;
  costPerPersonHour: number;
  baselineResponseCost: number;
  proposalHours: number;
  proposalResponseCost: number;
}
export interface ImpactResult {
  baselineCost: number;
  proposalCost: number;
  estimatedSavings: number;
  assumptions: string[];
}
export interface Incident {
  id: string;
  assetId: string;
  riskScore: number;
  severity: Severity;
  status: IncidentStatus;
  estimatedImpact: number;
  evidence: Evidence[];
  dataQuality: "sufficient" | "insufficient";
  assignedTo: string;
  createdAt: number;
  updatedAt: number;
  assumptions: ImpactInput;
}
export interface IncidentEvent {
  id: string;
  incidentId: string;
  actorIdentity: string;
  eventType: string;
  detail: string;
  createdAt: number;
}
export interface ActionProposal {
  id: string;
  incidentId: string;
  name: string;
  estimatedCost: number;
  status: ProposalStatus;
  createdBy: string;
  createdAt: number;
  proposalHours: number;
  impact: ImpactResult;
  revision: number;
}
export interface TeamMember {
  identity: string;
  displayName: string;
  role: Role;
}
export interface DemoFixture {
  buildings: Building[];
  zones: Zone[];
  assets: Asset[];
  readings: SensorReading[];
  tickets: MaintenanceTicket[];
  occupancy: OccupancySnapshot[];
  asOf: number;
}
export interface Portfolio {
  buildings: Building[];
  zones: Zone[];
  assets: Asset[];
  readings: SensorReading[];
  tickets: MaintenanceTicket[];
  occupancy: OccupancySnapshot[];
  incidents: Incident[];
  events: IncidentEvent[];
  proposals: ActionProposal[];
  members: TeamMember[];
}
export interface DominoActions {
  register: (displayName: string) => Promise<void>;
  injectScenario: () => Promise<void>;
  seedDemo: () => Promise<void>;
  resetDemo: () => Promise<void>;
  acknowledgeIncident: (incidentId: string) => Promise<void>;
  assignIncident: (
    incidentId: string,
    assigneeIdentity: string,
  ) => Promise<void>;
  proposeAction: (
    incidentId: string,
    name: string,
    proposalHours: number,
    estimatedCost: number,
  ) => Promise<void>;
  approveAction: (
    proposalId: string,
    expectedRevision: number,
  ) => Promise<void>;
  rejectAction: (proposalId: string) => Promise<void>;
  resolveIncident: (incidentId: string) => Promise<void>;
  updateAssumptions: (
    incidentId: string,
    assumptions: ImpactInput,
  ) => Promise<void>;
}
export interface DominoState {
  portfolio: Portfolio;
  identity: string;
  member: TeamMember | undefined;
  connectionStatus: "preview" | "connecting" | "live" | "disconnected" | "error";
  connectionError: string | undefined;
  actions: DominoActions;
  reconnect: () => void;
}
