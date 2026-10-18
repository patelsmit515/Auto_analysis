/**
 * Auto_analysis Charts View
 */

import { state } from "../state.js";
import { api } from "../api.js";
import { renderBoxPlot } from "../components/boxplot.js";
import { showToast } from "../components/toasts.js";

export function initChartsView(container) {
  let currentChartInstance = null;

  function render() {
    const activeDatasetName = state.activeDataset;
    const details = state.activeDatasetDetails;

    if (!activeDatasetName || !details) {
      container.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">📈</div>
            <h3 class="empty-state-title">No Active Dataset</h3>
            <p class="empty-state-text">Select or upload a dataset first to generate interactive charts.</p>
            <button class="btn btn-primary" id="chart-goto-dash">Go to Dashboard</button>
          </div>
        </div>`;
      container.querySelector("#chart-goto-dash")?.addEventListener("click", () => state.setTab("dashboard"));
      return;
    }

    const columns = details?.information?.column_names || [];
    const dataTypes = details?.information?.data_types || {};

    container.innerHTML = `
      <!-- Chart Controls Card -->
      <div class="card">
        <div class="card-header">
          <div class="card-title-group">
            <h3>Visual Chart Studio</h3>
            <p class="card-subtitle">Generate interactive visualizations from dataset '${escapeHtml(activeDatasetName)}'</p>
          </div>
        </div>

        <div class="card-body">
          <div class="form-row" style="align-items: flex-start;">
            <!-- Chart Type -->
            <div class="form-group" style="width: 200px; flex: none;">
              <label class="form-label">Chart Type</label>
              <select class="form-select" id="chart-type-select">
                <option value="bar">Bar Chart</option>
                <option value="line">Line Chart</option>
                <option value="scatter">Scatter Plot</option>
                <option value="histogram">Histogram</option>
                <option value="pie">Pie Chart</option>
                <option value="box">Box Plot</option>
              </select>
            </div>

            <!-- X-Axis Column -->
            <div class="form-group">
              <label class="form-label" id="chart-x-label">X-Axis Column</label>
              <select class="form-select" id="chart-x-select">
                ${columns.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)} (${escapeHtml(dataTypes[c] || "str")})</option>`).join("")}
              </select>
              <span class="form-hint" id="chart-x-hint">Category or horizontal axis</span>
            </div>

            <!-- Y-Axis Column -->
            <div class="form-group" id="chart-y-group">
              <label class="form-label" id="chart-y-label">Y-Axis Column (Numeric)</label>
              <select class="form-select" id="chart-y-select">
                <option value="">&mdash; Auto (Count frequencies) &mdash;</option>
                ${columns.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)} (${escapeHtml(dataTypes[c] || "str")})</option>`).join("")}
              </select>
              <span class="form-hint" id="chart-y-hint">Numeric metric or measurement</span>
            </div>

            <div class="form-group" style="width: 140px; flex: none; align-self: center; margin-top: 24px;">
              <button class="btn btn-primary" id="chart-render-btn" style="width: 100%;">Render Chart</button>
            </div>
          </div>

          <!-- Error Alert Banner -->
          <div id="chart-error-alert" class="alert alert-danger" style="display: none; margin-top: 14px;">
            <span class="alert-icon">✕</span>
            <div class="alert-content" id="chart-error-message"></div>
          </div>
        </div>
      </div>

      <!-- Chart Display Area -->
      <div class="card">
        <div class="card-header">
          <div class="card-title-group">
            <h3 id="chart-display-title">Visual Preview</h3>
            <p class="card-subtitle" id="chart-display-subtitle">Select variables and click Render Chart</p>
          </div>
        </div>

        <div class="card-body chart-card-body" id="chart-render-container">
          <div class="chart-canvas-wrap" id="chart-canvas-wrap">
            <canvas id="chart-canvas"></canvas>
          </div>
          <div id="chart-custom-container" style="display: none; width: 100%;"></div>
        </div>
      </div>`;

    // Dynamic field labels and restrictions based on chart type
    const typeSelect = container.querySelector("#chart-type-select");
    const xLabel = container.querySelector("#chart-x-label");
    const yLabel = container.querySelector("#chart-y-label");
    const xHint = container.querySelector("#chart-x-hint");
    const yHint = container.querySelector("#chart-y-hint");
    const yGroup = container.querySelector("#chart-y-group");
    const xSelect = container.querySelector("#chart-x-select");
    const ySelect = container.querySelector("#chart-y-select");
    const renderBtn = container.querySelector("#chart-render-btn");

    function updateFormRequirements() {
      const type = typeSelect.value;
      if (type === "histogram") {
        xLabel.textContent = "Numeric Column to Bin";
        xHint.textContent = "Histogram will divide this numeric column into value bins.";
        yGroup.style.display = "none";
      } else if (type === "box") {
        xLabel.textContent = "Group / Category Column";
        xHint.textContent = "Grouping dimension (e.g. City or Course_ID)";
        yGroup.style.display = "block";
        yLabel.textContent = "Numeric Value Column (Required)";
        yHint.textContent = "Five-number summary calculated on this numeric column (e.g. Score or Age)";
      } else if (type === "scatter") {
        xLabel.textContent = "X-Axis Numeric Column (Required)";
        xHint.textContent = "Must be a numeric column";
        yGroup.style.display = "block";
        yLabel.textContent = "Y-Axis Numeric Column (Required)";
        yHint.textContent = "Must be a numeric column";
      } else if (type === "line") {
        xLabel.textContent = "X-Axis Column";
        xHint.textContent = "Timeline, category, or order dimension";
        yGroup.style.display = "block";
        yLabel.textContent = "Y-Axis Numeric Column (Required)";
        yHint.textContent = "Must be numeric";
      } else {
        // bar or pie
        xLabel.textContent = "Category Column (X-Axis)";
        xHint.textContent = "Categories or groups";
        yGroup.style.display = "block";
        yLabel.textContent = "Value Column (Optional)";
        yHint.textContent = "Leave blank to plot counts of categories";
      }
    }

    if (typeSelect) {
      typeSelect.addEventListener("change", updateFormRequirements);
      updateFormRequirements();
    }

    if (renderBtn) {
      renderBtn.addEventListener("click", () => generateChart());
    }

    // Auto-select smart initial columns
    if (columns.length > 0) {
      if (columns.includes("City")) xSelect.value = "City";
      else if (columns.includes("Full_Name")) xSelect.value = "Full_Name";

      if (columns.includes("Score")) ySelect.value = "Score";
      else if (columns.includes("Age")) ySelect.value = "Age";
    }
  }

  async function generateChart() {
    const activeDatasetName = state.activeDataset;
    if (!activeDatasetName) return;

    const typeSelect = container.querySelector("#chart-type-select");
    const xSelect = container.querySelector("#chart-x-select");
    const ySelect = container.querySelector("#chart-y-select");
    const errorAlert = container.querySelector("#chart-error-alert");
    const errorMessage = container.querySelector("#chart-error-message");
    const displayTitle = container.querySelector("#chart-display-title");
    const displaySubtitle = container.querySelector("#chart-display-subtitle");
    const canvasWrap = container.querySelector("#chart-canvas-wrap");
    const customWrap = container.querySelector("#chart-custom-container");

    if (errorAlert) errorAlert.style.display = "none";

    const chartType = typeSelect.value;
    const xCol = xSelect.value;
    let yCol = ySelect.value.trim() || null;

    // For box plots, prompt user if Y is missing
    if (chartType === "box" && !yCol) {
      showToast("Box plots require a numeric Y-axis column.", "warning");
      return;
    }
    if ((chartType === "scatter" || chartType === "line") && !yCol) {
      showToast(`${chartType.toUpperCase()} chart requires a numeric Y-axis column.`, "warning");
      return;
    }

    try {
      const res = await api.getDatasetChart(activeDatasetName, chartType, xCol, yCol);
      const chartInfo = res.chart;
      const data = chartInfo.data || [];

      displayTitle.textContent = `${chartType.toUpperCase()} Chart &bull; ${chartInfo.x_column} ${chartInfo.y_column ? `vs ${chartInfo.y_column}` : ""}`;
      displaySubtitle.textContent = `Plotted from '${activeDatasetName}' (${data.length} records)`;

      if (chartType === "box") {
        // Render Box Plot using dedicated high-res SVG component
        canvasWrap.style.display = "none";
        customWrap.style.display = "block";
        renderBoxPlot(customWrap, data, chartInfo.x_column, chartInfo.y_column);
      } else {
        customWrap.style.display = "none";
        canvasWrap.style.display = "block";
        renderChartJs(chartType, chartInfo);
      }

      showToast(`Generated ${chartType} chart successfully.`, "success");
    } catch (err) {
      if (errorAlert && errorMessage) {
        errorMessage.textContent = err.message;
        errorAlert.style.display = "flex";
      }
      showToast(`Chart Error: ${err.message}`, "error");
    }
  }

  function renderChartJs(chartType, chartInfo) {
    const canvas = container.querySelector("#chart-canvas");
    if (!canvas) return;

    if (currentChartInstance) {
      currentChartInstance.destroy();
      currentChartInstance = null;
    }

    const Chart = window.Chart;
    if (!Chart) {
      container.querySelector("#chart-canvas-wrap").innerHTML = `
        <div class="alert alert-danger">Chart.js library is not available offline in vendor directory.</div>`;
      return;
    }

    const data = chartInfo.data || [];
    const xCol = chartInfo.x_column;
    const yCol = chartInfo.y_column || "count";

    // Prepare labels and values
    let chartConfig = null;

    if (chartType === "scatter") {
      const points = data.map((d) => ({
        x: Number(d[xCol]),
        y: Number(d[yCol]),
      })).filter((p) => !isNaN(p.x) && !isNaN(p.y));

      chartConfig = {
        type: "scatter",
        data: {
          datasets: [{
            label: `${xCol} vs ${yCol}`,
            data: points,
            backgroundColor: "#2563eb",
            borderColor: "#1d4ed8",
            pointRadius: 6,
            pointHoverRadius: 8,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { title: { display: true, text: xCol } },
            y: { title: { display: true, text: yCol } },
          },
        },
      };
    } else if (chartType === "histogram") {
      // Numerical binning
      const values = data.map((d) => Number(d[xCol])).filter((v) => !isNaN(v));
      const min = Math.min(...values);
      const max = Math.max(...values);
      const binCount = Math.min(10, Math.max(4, Math.floor(Math.sqrt(values.length))));
      const step = (max - min) / binCount || 1;

      const bins = Array.from({ length: binCount }, (_, i) => ({
        label: `${(min + i * step).toFixed(1)} - ${(min + (i + 1) * step).toFixed(1)}`,
        count: 0,
      }));

      for (const val of values) {
        let binIdx = Math.floor((val - min) / step);
        if (binIdx >= binCount) binIdx = binCount - 1;
        if (binIdx >= 0) bins[binIdx].count++;
      }

      chartConfig = {
        type: "bar",
        data: {
          labels: bins.map((b) => b.label),
          datasets: [{
            label: `Frequency of ${xCol}`,
            data: bins.map((b) => b.count),
            backgroundColor: "rgba(37, 99, 235, 0.7)",
            borderColor: "#2563eb",
            borderWidth: 1,
            barPercentage: 1.0,
            categoryPercentage: 1.0,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { title: { display: true, text: `${xCol} (Value Bins)` } },
            y: { title: { display: true, text: "Frequency (Count)" }, beginAtZero: true },
          },
        },
      };
    } else if (chartType === "pie") {
      const labels = data.map((d) => d[xCol] === null ? "Missing" : String(d[xCol]));
      const values = data.map((d) => Number(d[yCol]));

      const colors = [
        "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
        "#06b6d4", "#ec4899", "#84cc16", "#64748b", "#f97316"
      ];

      chartConfig = {
        type: "pie",
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: labels.map((_, i) => colors[i % colors.length]),
            borderWidth: 1,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
        },
      };
    } else {
      // bar or line
      const labels = data.map((d) => d[xCol] === null ? "Missing" : String(d[xCol]));
      const values = data.map((d) => Number(d[yCol]));

      chartConfig = {
        type: chartType,
        data: {
          labels,
          datasets: [{
            label: yCol,
            data: values,
            backgroundColor: chartType === "bar" ? "rgba(37, 99, 235, 0.75)" : "rgba(37, 99, 235, 0.15)",
            borderColor: "#2563eb",
            borderWidth: 2,
            fill: chartType === "line",
            tension: 0.2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { title: { display: true, text: xCol } },
            y: { title: { display: true, text: yCol }, beginAtZero: true },
          },
        },
      };
    }

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const textColor = isDark ? "#cbd5e1" : "#475569";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";

    // Apply global theme-aware styling to chartConfig
    if (chartConfig && chartConfig.options) {
      chartConfig.options.plugins = chartConfig.options.plugins || {};
      chartConfig.options.plugins.legend = chartConfig.options.plugins.legend || {};
      chartConfig.options.plugins.legend.labels = { color: textColor };

      if (chartConfig.options.scales) {
        for (const axisKey of Object.keys(chartConfig.options.scales)) {
          const axis = chartConfig.options.scales[axisKey];
          axis.ticks = axis.ticks || {};
          axis.ticks.color = textColor;
          axis.grid = axis.grid || {};
          axis.grid.color = gridColor;
          if (axis.title) {
            axis.title.color = textColor;
          }
        }
      }
    }

    currentChartInstance = new Chart(canvas, chartConfig);
  }

  state.on("dataset-changed", render);
  state.on("datasets-updated", render);

  render();
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
