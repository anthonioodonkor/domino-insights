import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Building, Portfolio } from "../lib/types";

export function BuildingGraph({
  building,
  portfolio,
  selectedAssetId,
  onSelectAsset,
}: {
  building: Building;
  portfolio: Portfolio;
  selectedAssetId: string;
  onSelectAsset: (id: string) => void;
}) {
  const zones = portfolio.zones.filter((z) => z.buildingId === building.id);
  const nodes: Node[] = [
    {
      id: building.id,
      position: { x: 250, y: 0 },
      data: { label: building.name },
      style: {
        background: "#153f32",
        color: "white",
        border: "none",
        width: 180,
        fontWeight: 600,
      },
    },
  ];
  const edges: Edge[] = [];
  zones.forEach((zone, index) => {
    const x = index * 240;
    nodes.push({
      id: zone.id,
      position: { x, y: 110 },
      data: { label: `${zone.name} · capacity ${zone.capacity}` },
      style: {
        width: 190,
        background: "#f2f5ef",
        borderColor: "#c9d5cb",
        fontSize: 12,
      },
    });
    edges.push({
      id: `${building.id}-${zone.id}`,
      source: building.id,
      target: zone.id,
      style: { stroke: "#acbdb1" },
    });
    portfolio.assets
      .filter((a) => a.zoneId === zone.id)
      .forEach((asset, assetIndex) => {
        const critical = portfolio.incidents.some(
          (i) =>
            i.assetId === asset.id &&
            i.status !== "resolved" &&
            i.severity === "critical",
        );
        nodes.push({
          id: asset.id,
          position: { x: x + (assetIndex % 2) * 28, y: 220 + assetIndex * 84 },
          data: {
            label: (
              <span>
                <strong>{asset.name}</strong>
                <br />
                <span style={{ fontSize: 10 }}>
                  {asset.assetType}
                  {critical ? " · critical" : ""}
                </span>
              </span>
            ),
          },
          style: {
            width: 175,
            border: `${selectedAssetId === asset.id ? 2 : 1}px solid ${critical ? "#d68370" : selectedAssetId === asset.id ? "#276448" : "#d8e0da"}`,
            background: critical ? "#fff3ef" : "white",
            color: critical ? "#9d4433" : "#264033",
            cursor: "pointer",
          },
        });
        edges.push({
          id: `${zone.id}-${asset.id}`,
          source: zone.id,
          target: asset.id,
          animated: critical,
          style: { stroke: critical ? "#d68370" : "#acbdb1" },
        });
      });
  });
  return (
    <div
      className="building-graph"
      aria-label="Building, zone and asset relationship graph"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.22 }}
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={(_, node) => {
          if (portfolio.assets.some((a) => a.id === node.id))
            onSelectAsset(node.id);
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#d4ded6" gap={22} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
