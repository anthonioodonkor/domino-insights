import { useState, useEffect } from 'react';
import { DbConnection } from './module_bindings';

// 1. Initialize the direct database connection
const conn = DbConnection.builder()
  .withUri("https://maincloud.spacetimedb.com") 
  .withDatabaseName("cbre-telemetry")
  .build();

export default function App() {
  const [description, setDescription] = useState("");
  const [incidents, setIncidents] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // 2. Request a live subscription to all infrastructure tables
    conn.subscriptionBuilder()
      .onApplied(() => {
        setIsConnected(true);
        // Pull initial data from the active connection cache
        setIncidents(Array.from(conn.db.incidentLog.iter()));
        setComponents(Array.from(conn.db.systemComponent.iter()));
        setTenants(Array.from(conn.db.tenantLease.iter()));
        setWorkOrders(Array.from(conn.db.workOrder.iter()));
      })
      .subscribe([
        "SELECT * FROM incident_log", 
        "SELECT * FROM facility",
        "SELECT * FROM system_component",
        "SELECT * FROM system_dependency",
        "SELECT * FROM tenant_lease",
        "SELECT * FROM work_order"
      ]);

    // 3. Listen for real-time inserts across tables
    conn.db.incidentLog.onInsert(() => setIncidents(Array.from(conn.db.incidentLog.iter())));
    conn.db.systemComponent.onInsert(() => setComponents(Array.from(conn.db.systemComponent.iter())));
    conn.db.tenantLease.onInsert(() => setTenants(Array.from(conn.db.tenantLease.iter())));
    conn.db.workOrder.onInsert(() => setWorkOrders(Array.from(conn.db.workOrder.iter())));
    
    // Also listen for updates (e.g., component status changes and work orders)
    conn.db.systemComponent.onUpdate(() => setComponents(Array.from(conn.db.systemComponent.iter())));
    conn.db.workOrder.onUpdate(() => setWorkOrders(Array.from(conn.db.workOrder.iter())));

  }, []);

const handleSimulateIncident = (e: React.FormEvent) => {
    e.preventDefault();
    const mockLogId = `LOG-${Date.now()}`;
    
    try {
      conn.reducers.logIncident({
        logId: mockLogId,
        componentId: "COMP-CH-01",
        description: description || "Thermal overload in cooling loop",
        severity: "Critical"
      });
    } catch (err) {
      console.error("Failed to invoke reducer:", err);
    }
    
    setDescription("");
  };
  
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>CBRE Invisible Network Dashboard</h1>
      <p style={{ fontWeight: 'bold', color: isConnected ? 'green' : 'red' }}>
        Status: {isConnected ? "🟢 Connected to Maincloud (Live WebSocket)" : "🔴 Connecting..."}
      </p>

      {/* Grid Layout for Campus Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
        
        {/* Left Column: Infrastructure & Simulation */}
        <div>
          <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
            <h2>Simulate Critical Cascade</h2>
            <form onSubmit={handleSimulateIncident}>
              <input 
                type="text" 
                placeholder="e.g., Chiller-1 failure..." 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ padding: '0.5rem', width: '65%', marginRight: '1rem' }}
                disabled={!isConnected}
              />
              <button type="submit" style={{ padding: '0.5rem 1rem', background: '#d9534f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }} disabled={!isConnected}>
                Trigger Alert
              </button>
            </form>
          </div>

          <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '2rem' }}>
            <h2>Campus Components ({components.length})</h2>
            <ul>
              {components.map((comp) => (
                <li key={comp.componentId} style={{ marginBottom: '0.5rem' }}>
                  <strong>{comp.name || comp.componentId}</strong> ({comp.systemType}) — 
                  <span style={{ color: comp.status === 'Failed' ? 'red' : 'green', fontWeight: 'bold', marginLeft: '5px' }}>
                    {comp.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
            <h2>Tenant SLA Exposure ({tenants.length})</h2>
            <ul>
              {tenants.map((tenant) => (
                <li key={tenant.tenantId} style={{ marginBottom: '0.5rem' }}>
                  <strong>{tenant.name}</strong> — Penalty: ${tenant.hourlySlaPenalty}/hr 
                  <span style={{ color: 'gray', fontSize: '0.85em', display: 'block' }}>
                    Dependent on: {tenant.dependentComponentId}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Column: Automated Actions & Live Logs */}
        <div>
          <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '2rem', background: '#f9f9f9' }}>
            <h2>Automated Work Orders ({workOrders.length})</h2>
            {workOrders.length === 0 ? (
              <p style={{ color: 'gray' }}>No active work orders. System operating normally.</p>
            ) : (
              <ul>
                {workOrders.map((wo) => (
                  <li key={wo.orderId} style={{ marginBottom: '0.75rem', background: '#fff', padding: '0.5rem', borderLeft: '4px solid #d9534f' }}>
                    <strong>{wo.orderId}</strong> [{wo.priority}]<br />
                    {wo.description}
                    <div style={{ fontSize: '0.8em', color: '#666', marginTop: '4px' }}>
                      Status: {wo.status} | Component: {wo.componentId}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
            <h2>Live Incident Logs ({incidents.length})</h2>
            <ul>
              {incidents.map((incident) => (
                <li key={incident.logId} style={{ marginBottom: '0.5rem' }}>
                  <strong>{incident.severity}</strong>: {incident.description} 
                  <span style={{ color: 'gray', fontSize: '0.8em', display: 'block' }}>
                    Component: {incident.componentId}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}