
import { createServer } from 'node:http';

const HOST = '127.0.0.1';
const PORT = Number(process.env.DOMINO_AI_PORT ?? 8787);

const DATABASE_ID =
  'c2007fc61174d2aaa65e4d092a22cc16b472c76f4905c17749c6de0e6c862970';

const DATABASE_URL =
  `https://maincloud.spacetimedb.com/v1/database/${DATABASE_ID}/sql`;

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });

  res.end(JSON.stringify(data));
}

// Only server-defined queries are permitted.
// Never accept SQL supplied by the browser or LLM.
async function executeReadOnlyQuery(sql) {
  const response = await fetch(DATABASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: sql,
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(
      `SpacetimeDB query failed: HTTP ${response.status}`
    );
  }

  const results = await response.json();
  const result = results[0];

  if (!result?.schema?.elements || !Array.isArray(result.rows)) {
    throw new Error('Unexpected SpacetimeDB response.');
  }

  const columns = result.schema.elements.map(
    (element) => element.name?.some
  );

  if (columns.some((name) => typeof name !== 'string')) {
    throw new Error('Invalid SpacetimeDB column metadata.');
  }

  return result.rows.map((values) =>
    Object.fromEntries(
      columns.map((column, index) => [column, values[index]])
    )
  );
}

async function getCampusOverview() {
  const facilities = await executeReadOnlyQuery(
    'SELECT facility_id, name, location, overall_status FROM facility'
  );

  return {
    database: 'cbre-telemetry-dev',
    source: 'spacetimedb',
    sourceKind: 'synthetic_campus',
    facilityCount: facilities.length,
    facilities,
  };
} 


async function getOperationsSnapshot() {
  // Fixed, read-only queries. No user-provided SQL.
  const [assets, components, faultRecords, tenants] =
    await Promise.all([
      executeReadOnlyQuery(
        'SELECT component_id, domain, asset_name, location, criticality FROM asset_profile'
      ),
      executeReadOnlyQuery(
        'SELECT component_id, facility_id, system_type, status FROM system_component'
      ),
      executeReadOnlyQuery(
        'SELECT component_id, incident_id, work_order_id, status FROM active_fault'
      ),
      executeReadOnlyQuery(
        'SELECT tenant_id, name, dependent_component_id, hourly_sla_penalty FROM tenant_lease'
      ),
    ]);

  // Resolved records may remain in the active_fault table.
  const unresolvedFaults = faultRecords.filter(
    (fault) => String(fault.status).toUpperCase() !== 'RESOLVED'
  );

  return {
    database: 'cbre-telemetry-dev',
    source: 'spacetimedb',
    sourceKind: 'synthetic_campus',
    retrievedAt: new Date().toISOString(),

    counts: {
      assets: assets.length,
      components: components.length,
      tenants: tenants.length,
      unresolvedFaults: unresolvedFaults.length,
    },

    assets,
    components,
    faultRecords,
    unresolvedFaults,
    tenants,

    notes: [
      'Campus and tenant records are fictional demonstration data.',
      'Recorded component status is not proof of real-time equipment health.',
      'SLA penalties are illustrative hourly exposure rates.',
    ],
  };
}


async function getDependencySnapshot() {
  const [edges, rules] = await Promise.all([
    executeReadOnlyQuery(
      'SELECT dependency_id, parent_component_id, child_component_id FROM system_dependency'
    ),
    executeReadOnlyQuery(
      'SELECT dependency_id, relationship_type, requirement_group FROM dependency_rule'
    ),
  ]);

  const rulesById = new Map(
    rules.map((rule) => [rule.dependency_id, rule])
  );

  // Only include the seeded multi-silo demonstration graph.
  const dependencies = edges
    .filter((edge) => edge.dependency_id.startsWith('MS-DEP-'))
    .map((edge) => {
      const rule = rulesById.get(edge.dependency_id);

      if (!rule) {
        throw new Error(
          `Missing dependency rule: ${edge.dependency_id}`
        );
      }

      return {
        dependency_id: edge.dependency_id,
        upstream_component_id: edge.parent_component_id,
        downstream_component_id: edge.child_component_id,
        relationship_type: rule.relationship_type,
        requirement_group: rule.requirement_group,
      };
    });

  return {
    database: 'cbre-telemetry-dev',
    source: 'spacetimedb',
    sourceKind: 'synthetic_campus',
    dependencyCount: dependencies.length,
    ruleCount: rules.length,
    dependencies,
    note:
      'Dependency edges describe a fictional campus. Direct dependencies are not the same as calculated cascade impacts.',
  };
}


async function getHistoricalTelemetrySnapshot() {
  const readings = await executeReadOnlyQuery(
    "SELECT reading_id, component_id, metric_name, value, timestamp, source_kind, is_live, sequence_id, source_component_id, timestamp_verification FROM research_telemetry WHERE sequence_id = 'LBNL-2E91'"
  );

  // Keep this endpoint scoped to the reviewed research source.
  const validated = readings.every(
    (reading) =>
      reading.component_id === 'MS-CHILLER-1' &&
      reading.source_component_id === 'COMP-CH-01' &&
      reading.source_kind === 'research_simulation' &&
      reading.is_live === false &&
      reading.timestamp_verification === 'unverified_fixed_offset'
  );

  if (!validated) {
    throw new Error('Unexpected research telemetry metadata.');
  }

  // Ensure a consistent order for analysis and comparisons.
  readings.sort(
    (a, b) =>
      a.timestamp - b.timestamp ||
      a.reading_id.localeCompare(b.reading_id)
  );

  return {
    database: 'cbre-telemetry-dev',
    source: 'spacetimedb',
    sourceKind: 'research_simulation',
    isLive: false,
    sequenceId: 'LBNL-2E91',
    componentId: 'MS-CHILLER-1',
    readingCount: readings.length,
    metricNames: [...new Set(readings.map((r) => r.metric_name))],
    timestampVerification: 'unverified_fixed_offset',
    notes: [
      'These readings come from a historical LBNL simulation.',
      'The UTC-06:00 timestamp offset is an unverified assumption.',
      'Chiller_on indicates operating state, not equipment health.',
      'Research telemetry must not be interpreted as live operational faults.',
    ],
    readings,
  };
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/api/health') {
    return sendJson(res, 200, {
      service: 'Ask Domino AI',
      status: 'ok',
      databaseMode: 'read-only',
      llmConnected: false,
    });
  }

  if (req.method === 'GET' && req.url === '/api/campus') {
    try {
      const overview = await getCampusOverview();
      return sendJson(res, 200, overview);
    } catch (error) {
      console.error('Campus query failed:', error);
      return sendJson(res, 502, {
        error: 'Unable to retrieve campus data',
      });
    }
  }

  
    if (req.method === 'GET' && req.url === '/api/operations') {
    try {
        const snapshot = await getOperationsSnapshot();
        return sendJson(res, 200, snapshot);
    } catch (error) {
        console.error('Operations query failed:', error);

        return sendJson(res, 502, {
        error: 'Unable to retrieve operational data',
        });
    }
    }

    
    if (req.method === 'GET' && req.url === '/api/dependencies') {
    try {
        const snapshot = await getDependencySnapshot();
        return sendJson(res, 200, snapshot);
    } catch (error) {
        console.error('Dependency query failed:', error);

        return sendJson(res, 502, {
        error: 'Unable to retrieve dependency data',
        });
    }
    }

    if (req.method === 'GET' && req.url === '/api/telemetry') {
    try {
        const snapshot = await getHistoricalTelemetrySnapshot();
        return sendJson(res, 200, snapshot);
    } catch (error) {
        console.error('Telemetry query failed:', error);

        return sendJson(res, 502, {
        error: 'Unable to retrieve historical telemetry',
        });
    }
    }

  return sendJson(res, 404, {
    error: 'Endpoint not found',
  });
});

server.listen(PORT, HOST, () => {
  console.log('Ask Domino AI server running');
  console.log(`Health: http://${HOST}:${PORT}/api/health`);
  console.log(`Campus: http://${HOST}:${PORT}/api/campus`);
});
