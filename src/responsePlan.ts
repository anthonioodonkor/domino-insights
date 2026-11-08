type PlanInput = {
  componentId: string;
  assetName: string;
  domain: string;
  affectedServices: string[];
  affectedTenants: string[];
};

export function buildResponsePlan(input: PlanInput) {
  const pump = input.componentId.includes('PUMP');
  const cooling = input.domain === 'HVAC';
  const power = input.domain === 'UTILITIES';
  const access = input.domain === 'ACCESS_CONTROL';
  const specialist = cooling ? 'Facilities + HVAC technician' : power ? 'Facilities + electrical specialist' : access ? 'Facilities + security operator' : 'Facilities + system owner';
  const inspection = pump
    ? 'Request a qualified HVAC technician to verify pump operation and flow serving both air handlers. A second chiller does not bypass the shared pump.'
    : cooling
      ? 'Request an HVAC inspection of the cooling service. Verify the alternate supply, supporting pump, controls, and available capacity before proposing failover.'
      : power
        ? 'Request an electrical specialist to verify the affected supply, downstream equipment, and alternate-path readiness under the site procedure.'
        : access
          ? 'Ask security to verify the controller, reader, and approved maintenance access route. Coordinate an authorized escort if normal access is unavailable.'
          : 'Ask the system owner to verify the affected service and identify a supported recovery approach under the site procedure.';
  const evidence = cooling ? 'Technician findings, current cooling/flow observations, and the proposed restoration method.' : power ? 'Specialist findings and confirmation of the proposed supply path and its readiness.' : access ? 'Security verification, approved route, and escort/authorization details where needed.' : 'System-owner findings, service checks, and a proposed recovery method.';
  return [
    { title: 'Acknowledge and take ownership', owner: 'Facilities operator',
      task: `Review the incident and work order for ${input.assetName} (${input.componentId}). Acknowledge the matching incident and coordinate an investigation owner.`,
      evidence: 'Matching incident/work-order IDs and a recorded acknowledgement. An acknowledgement does not itself dispatch a technician.' },
    { title: 'Verify the condition and investigate', owner: specialist, task: inspection, evidence },
    { title: 'Coordinate the downstream impact', owner: 'Facilities + tenant liaison',
      task: input.affectedServices.length
        ? `Check these predicted affected services: ${input.affectedServices.join(', ')}. ${input.affectedTenants.length ? `Prepare a status update for ${input.affectedTenants.join(', ')}.` : 'Confirm whether any tenant-facing service is affected.'} Distinguish predicted exposure from an observed interruption.`
        : 'Verify the surviving dependency path before assuming service is unaffected. No downstream loss is predicted by this single-failure model; continue investigating the failed asset.',
      evidence: 'Confirmed service observations, coordination owner, and a proposed next update. Notifications are not sent by this demo.' },
    { title: 'Approve a specific response', owner: 'Responsible operator / site approver',
      task: pump ? 'Review the technician-dispatch plan and record approval after acknowledgement. Do not choose cooling failover as a substitute for restoring this shared pump.' : 'Review the investigation and record an appropriate simulated dispatch or failover approval after acknowledgement. Approval records a decision; it does not operate equipment.',
      evidence: 'Recorded action and approver. A new fault after approval requires a fresh review and reapproval.' },
    { title: 'Verify recovery before closing', owner: 'Facilities operator + service owner',
      task: 'Verify recovery of the affected asset and downstream service. In this simulation, provide a fresh operational-status reading of 1 after both approval and the latest fault, then request resolution of the matching incident.',
      evidence: 'The backend requires approval and a newer healthy synthetic reading, then records the recovery reading, resolver, and closure. Historical LBNL data cannot serve as this recovery evidence.' },
  ];
}

export function nextResponseStep(incidentId?: string, responseState?: string, approvedAt = 0, lastFaultAt = 0) {
  if (!incidentId) return 'Create the simulated response to obtain linked incident and work-order IDs, then acknowledge the incident.';
  if (!responseState) return 'Acknowledge this incident and coordinate an investigation owner.';
  if (responseState === 'ACKNOWLEDGED') return 'Verify the condition, coordinate affected services, and record approval of a specific response.';
  if (responseState === 'APPROVED' && lastFaultAt > approvedAt) return 'A newer fault was recorded after approval. Review the condition and reapprove before attempting closure.';
  if (responseState === 'APPROVED') return 'Verify recovery, provide fresh synthetic operational evidence, then request resolution. Approval alone is not recovery.';
  if (responseState === 'RESOLVED') return 'The response is recorded as resolved. Review its recovery evidence and complete the operator handoff.';
  return 'Review the recorded response state with the facilities operator before proceeding.';
}
