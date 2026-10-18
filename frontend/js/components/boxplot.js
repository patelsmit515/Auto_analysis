/**
 * Auto_analysis Box Plot Visualizer
 * Renders high-precision Five-Number Summary SVG box plots for numeric columns.
 */

export function renderBoxPlot(container, data, xColumn, yColumn) {
  if (!container) return;

  // Extract numeric values from data
  const rawValues = data
    .map((d) => d[yColumn])
    .filter((v) => v !== null && v !== undefined && !isNaN(Number(v)))
    .map((v) => Number(v));

  if (rawValues.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 32px;">
        <p class="empty-state-text">No valid numeric data found for box plot in column '${yColumn}'</p>
      </div>`;
    return;
  }

  // Sort values
  const values = rawValues.sort((a, b) => a - b);
  const n = values.length;

  const quantile = (arr, q) => {
    const pos = (arr.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (arr[base + 1] !== undefined) {
      return arr[base] + rest * (arr[base + 1] - arr[base]);
    }
    return arr[base];
  };

  const min = values[0];
  const max = values[n - 1];
  const q1 = quantile(values, 0.25);
  const median = quantile(values, 0.5);
  const q3 = quantile(values, 0.75);
  const iqr = q3 - q1;
  const mean = values.reduce((a, b) => a + b, 0) / n;

  // Outlier thresholds
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  const nonOutliers = values.filter((v) => v >= lowerFence && v <= upperFence);
  const whiskerMin = nonOutliers.length > 0 ? nonOutliers[0] : min;
  const whiskerMax = nonOutliers.length > 0 ? nonOutliers[nonOutliers.length - 1] : max;
  const outliers = values.filter((v) => v < lowerFence || v > upperFence);

  // SVG dimensions
  const svgWidth = 600;
  const svgHeight = 360;
  const margin = { top: 40, right: 60, bottom: 60, left: 80 };
  const plotWidth = svgWidth - margin.left - margin.right;
  const plotHeight = svgHeight - margin.top - margin.bottom;

  // Scale: map value to Y coordinate (inverted)
  const valMin = Math.min(min, lowerFence);
  const valMax = Math.max(max, upperFence);
  const range = valMax - valMin === 0 ? 1 : valMax - valMin;

  const yScale = (val) => {
    return margin.top + plotHeight - ((val - valMin) / range) * plotHeight;
  };

  const boxCenterX = margin.left + plotWidth / 2;
  const boxWidth = 140;

  const yQ1 = yScale(q1);
  const yQ3 = yScale(q3);
  const yMedian = yScale(median);
  const yWMin = yScale(whiskerMin);
  const yWMax = yScale(whiskerMax);

  // Grid tick values
  const ticks = 5;
  const tickStep = range / ticks;
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) => valMin + i * tickStep);

  let ticksSvg = tickValues
    .map((tv) => {
      const y = yScale(tv);
      return `
        <line x1="${margin.left - 6}" y1="${y}" x2="${svgWidth - margin.right}" y2="${y}" stroke="currentColor" opacity="0.1" stroke-dasharray="3,3" />
        <text x="${margin.left - 12}" y="${y + 4}" fill="currentColor" opacity="0.75" font-size="11" text-anchor="end" font-family="system-ui">${tv.toFixed(1)}</text>
      `;
    })
    .join("");

  // Outlier dots SVG
  let outliersSvg = outliers
    .map((ov) => {
      const y = yScale(ov);
      return `<circle cx="${boxCenterX}" cy="${y}" r="4" fill="#ef4444" opacity="0.85"><title>Outlier: ${ov}</title></circle>`;
    })
    .join("");

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
      <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; max-width: 650px; height: auto; color: var(--text-main);">
        <!-- Axes and Background Grid -->
        ${ticksSvg}
        <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="currentColor" opacity="0.3" stroke-width="1.5" />
        <line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${svgWidth - margin.right}" y2="${margin.top + plotHeight}" stroke="currentColor" opacity="0.3" stroke-width="1.5" />

        <!-- Whisker Line -->
        <line x1="${boxCenterX}" y1="${yWMin}" x2="${boxCenterX}" y2="${yWMax}" stroke="currentColor" opacity="0.6" stroke-width="2" stroke-dasharray="4,4" />

        <!-- Whisker Caps -->
        <line x1="${boxCenterX - boxWidth / 4}" y1="${yWMin}" x2="${boxCenterX + boxWidth / 4}" y2="${yWMin}" stroke="currentColor" opacity="0.8" stroke-width="2" />
        <line x1="${boxCenterX - boxWidth / 4}" y1="${yWMax}" x2="${boxCenterX + boxWidth / 4}" y2="${yWMax}" stroke="currentColor" opacity="0.8" stroke-width="2" />

        <!-- Box (Q1 to Q3) -->
        <rect
          x="${boxCenterX - boxWidth / 2}"
          y="${yQ3}"
          width="${boxWidth}"
          height="${Math.max(2, yQ1 - yQ3)}"
          fill="rgba(59, 130, 246, 0.25)"
          stroke="#3b82f6"
          stroke-width="2"
          rx="4"
        >
          <title>IQR: ${iqr.toFixed(2)} (Q1: ${q1.toFixed(2)} to Q3: ${q3.toFixed(2)})</title>
        </rect>

        <!-- Median Line -->
        <line
          x1="${boxCenterX - boxWidth / 2}"
          y1="${yMedian}"
          x2="${boxCenterX + boxWidth / 2}"
          y2="${yMedian}"
          stroke="#2563eb"
          stroke-width="3"
        >
          <title>Median: ${median.toFixed(2)}</title>
        </line>

        <!-- Mean Point (diamond) -->
        <polygon
          points="${boxCenterX},${yScale(mean) - 5} ${boxCenterX + 5},${yScale(mean)} ${boxCenterX},${yScale(mean) + 5} ${boxCenterX - 5},${yScale(mean)}"
          fill="#10b981"
        >
          <title>Mean: ${mean.toFixed(2)}</title>
        </polygon>

        <!-- Outliers -->
        ${outliersSvg}

        <!-- Labels -->
        <text x="${boxCenterX}" y="${svgHeight - 16}" fill="currentColor" font-weight="600" font-size="13" text-anchor="middle" font-family="system-ui">
          ${escapeHtml(yColumn)} (Grouped by ${escapeHtml(xColumn)})
        </text>
      </svg>

      <!-- Summary Metric Pills -->
      <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 12px; font-size: 12px;">
        <span class="badge badge-subtle">Min: <strong>${min.toFixed(2)}</strong></span>
        <span class="badge badge-primary">Q1 (25%): <strong>${q1.toFixed(2)}</strong></span>
        <span class="badge badge-primary" style="background:#bfdbfe; color:#1e40af;">Median: <strong>${median.toFixed(2)}</strong></span>
        <span class="badge badge-success">Mean: <strong>${mean.toFixed(2)}</strong></span>
        <span class="badge badge-primary">Q3 (75%): <strong>${q3.toFixed(2)}</strong></span>
        <span class="badge badge-subtle">Max: <strong>${max.toFixed(2)}</strong></span>
        <span class="badge badge-info">IQR: <strong>${iqr.toFixed(2)}</strong></span>
        ${outliers.length > 0 ? `<span class="badge badge-danger">Outliers: <strong>${outliers.length}</strong></span>` : ""}
      </div>
    </div>`;
}

function escapeHtml(val) {
  if (val === null || val === undefined) return "";
  return String(val).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}
