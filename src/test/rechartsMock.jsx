export function ResponsiveContainer({ children }) {
  return <div data-testid="responsive-container">{children}</div>;
}

export function LineChart({ children }) {
  return <div data-testid="line-chart">{children}</div>;
}

export function BarChart({ children }) {
  return <div data-testid="bar-chart">{children}</div>;
}

export function CartesianGrid() {
  return <div data-testid="cartesian-grid" />;
}

export function Legend() {
  return <div data-testid="legend" />;
}

export function Line() {
  return <div data-testid="line" />;
}

export function Tooltip() {
  return <div data-testid="tooltip" />;
}

export function XAxis() {
  return <div data-testid="x-axis" />;
}

export function YAxis() {
  return <div data-testid="y-axis" />;
}

export function Bar({ children }) {
  return <div data-testid="bar">{children}</div>;
}

export function Cell() {
  return <div data-testid="cell" />;
}
