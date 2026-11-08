import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SensorReading } from "../lib/types";
import { time } from "../lib/format";

export function SensorTrendChart({ readings }: { readings: SensorReading[] }) {
  const grouped = new Map<
    number,
    { timestamp: number; output?: number; temperature?: number }
  >();
  readings.forEach((r) => {
    const row = grouped.get(r.recordedAt) ?? { timestamp: r.recordedAt };
    if (Number.isFinite(r.value))
      row[r.metric === "output_pct" ? "output" : "temperature"] = r.value;
    grouped.set(r.recordedAt, row);
  });
  const data = [...grouped.values()].sort((a, b) => a.timestamp - b.timestamp);
  if (!data.length)
    return (
      <div className="chart-empty">No telemetry available for this asset.</div>
    );
  return (
    <>
      <div className="chart-legend">
        <span>
          <i className="legend-output" />
          Cooling output (%)
        </span>
        <span>
          <i className="legend-temperature" />
          Temperature (°C)
        </span>
      </div>
      <div
        className="sensor-chart"
        role="img"
        aria-label="Cooling output percentage and temperature over simulation time"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 12, right: 4, left: -16, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="#e8ece9" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={time}
              minTickGap={50}
              tick={{ fill: "#748079", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="output"
              domain={[0, 100]}
              tick={{ fill: "#748079", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              unit="%"
            />
            <YAxis
              yAxisId="temp"
              orientation="right"
              tick={{ fill: "#748079", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              unit="°"
            />
            <Tooltip
              labelFormatter={(v) => time(Number(v))}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #dfe5e0",
                fontSize: 12,
              }}
            />
            <Line
              isAnimationActive={false}
              yAxisId="output"
              name="Output (%)"
              type="monotone"
              dataKey="output"
              stroke="#235f47"
              strokeWidth={2.5}
              dot={data.length < 4}
              connectNulls={false}
            />
            <Line
              isAnimationActive={false}
              yAxisId="temp"
              name="Temperature (°C)"
              type="monotone"
              dataKey="temperature"
              stroke="#c58b41"
              strokeWidth={2}
              dot={data.length < 4}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="small muted chart-note">
        Synthetic telemetry · timestamps follow the simulation clock
      </p>
    </>
  );
}
