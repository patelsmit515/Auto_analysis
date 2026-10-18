/**
 * Auto_analysis Export View
 */

import { state } from "../state.js";
import { api } from "../api.js";
import { PaginatedTable } from "../components/table.js";
import { showToast } from "../components/toasts.js";

export function initExportView(container) {
  let tableInstance = null;

  function render() {
    const datasets = state.datasets;
    const activeDatasetName = state.activeDataset;
    const details = state.activeDatasetDetails;

    if (!activeDatasetName || !details) {
      container.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">📥</div>
            <h3 class="empty-state-title">No Dataset to Export</h3>
            <p class="empty-state-text">Load or clean a dataset first to download it as a clean CSV file.</p>
            <button class="btn btn-primary" id="export-goto-dash">Go to Dashboard</button>
          </div>
        </div>`;
      container.querySelector("#export-goto-dash")?.addEventListener("click", () => state.setTab("dashboard"));
      return;
    }

    const defaultFilename = `cleaned_${activeDatasetName}.csv`;

    container.innerHTML = `
      <!-- Export Configuration Card -->
      <div class="card">
        <div class="card-header">
          <div class="card-title-group">
            <h3>Export Dataset as CSV</h3>
            <p class="card-subtitle">Download your cleaned dataset locally without affecting the original input file</p>
          </div>
        </div>
        <div class="card-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Dataset to Export</label>
              <select class="form-select" id="export-dataset-select">
                ${datasets.map((d) => `<option value="${escapeHtml(d.name)}" ${d.name === activeDatasetName ? "selected" : ""}>${escapeHtml(d.name)} (${d.rows} rows &bull; ${d.columns} cols)</option>`).join("")}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Export Filename</label>
              <input type="text" class="form-control" id="export-filename-input" value="${escapeHtml(defaultFilename)}" />
              <span class="form-hint">Filename will have a .csv extension</span>
            </div>

            <div class="form-group" style="display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 8px;">
              <label class="checkbox-group">
                <input type="checkbox" id="export-index-chk" />
                <span>Include DataFrame Index Column</span>
              </label>
            </div>

            <div class="form-group" style="width: 180px; flex: none; align-self: flex-end; margin-bottom: 0;">
              <button class="btn btn-primary" id="export-download-btn" style="width: 100%; padding: 9px 16px;">
                ⬇ Download CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Preview of Data to be Exported -->
      <div class="card">
        <div class="card-header">
          <div class="card-title-group">
            <h3>Export Preview</h3>
            <p class="card-subtitle">Verify records and column headers before downloading</p>
          </div>
          <span class="badge badge-subtle">${details.information.rows} rows &bull; ${details.information.columns} columns</span>
        </div>
        <div class="card-body" style="padding: 0;">
          <div id="export-table-container"></div>
        </div>
      </div>`;

    const datasetSelect = container.querySelector("#export-dataset-select");
    const downloadBtn = container.querySelector("#export-download-btn");
    const filenameInput = container.querySelector("#export-filename-input");
    const indexChk = container.querySelector("#export-index-chk");

    if (datasetSelect) {
      datasetSelect.addEventListener("change", () => {
        state.setActiveDataset(datasetSelect.value);
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener("click", () => {
        const datasetName = datasetSelect.value;
        const filename = filenameInput.value.trim() || `cleaned_${datasetName}.csv`;
        const includeIndex = indexChk.checked;

        const downloadUrl = api.getExportUrl(datasetName, filename, includeIndex);

        // Trigger browser download via anchor click
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        showToast(`Downloading '${filename}'...`, "success");
      });
    }

    // Render Preview Table
    const tableContainer = container.querySelector("#export-table-container");
    if (tableContainer && activeDatasetName) {
      tableInstance = new PaginatedTable(tableContainer, activeDatasetName, { pageSize: 25 });
      tableInstance.load();
    }
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
