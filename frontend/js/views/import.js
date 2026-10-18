/**
 * Auto_analysis Import and Inspect Data View
 */

import { state } from "../state.js";
import { api } from "../api.js";
import { PaginatedTable } from "../components/table.js";
import { showToast } from "../components/toasts.js";

export function initImportView(container) {
  let tableInstance = null;

  function render() {
    const activeDatasetName = state.activeDataset;
    const details = state.activeDatasetDetails;

    container.innerHTML = `
      <!-- Upload / Sample Box -->
      <div class="card">
        <div class="card-header">
          <div class="card-title-group">
            <h3>Import New CSV Dataset</h3>
            <p class="card-subtitle">Upload a local CSV file or load an available test dataset</p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-outline btn-sm" id="import-load-workflow-btn">Load test_workflow.csv</button>
            <button class="btn btn-outline btn-sm" id="import-load-courses-btn">Load test_courses.csv</button>
          </div>
        </div>
        <div class="card-body">
          <div id="drop-zone" style="border: 2px dashed var(--border-medium); border-radius: var(--radius-lg); padding: 36px 20px; text-align: center; background: var(--bg-surface); cursor: pointer; transition: all 0.2s ease;">
            <div style="font-size: 32px; margin-bottom: 8px;">📁</div>
            <h4 style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">Drag and drop your CSV file here, or click to browse</h4>
            <p style="font-size: 12.5px; color: var(--text-muted); margin-bottom: 14px;">Supported file format: .csv (processed entirely locally)</p>
            <input type="file" id="file-input" accept=".csv" style="display: none;" />
            <button class="btn btn-primary btn-sm" id="browse-btn">Choose File</button>
          </div>
        </div>
      </div>

      <!-- Dataset Inspection & Table Browser -->
      ${activeDatasetName && details ? `
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h3>Active Dataset: <span style="color: var(--primary); font-family: var(--font-mono);">${escapeHtml(activeDatasetName)}</span></h3>
              <p class="card-subtitle">
                ${details.information.rows.toLocaleString()} rows &bull; 
                ${details.information.columns} columns &bull; 
                ${details.information.missing_values} missing values &bull; 
                ${details.information.duplicate_rows} duplicates
              </p>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-outline btn-sm" id="import-reset-btn" title="Revert all transformations back to original uploaded state">Reset Dataset</button>
              <button class="btn btn-primary btn-sm" id="import-clean-btn">Go to Clean & Transform &rarr;</button>
            </div>
          </div>
          <div class="card-body" style="padding: 0;">
            <div id="import-table-container"></div>
          </div>
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <h3 class="empty-state-title">No Dataset Selected</h3>
          <p class="empty-state-text">Upload a CSV above or choose a sample to inspect column types and records.</p>
        </div>
      `}`;

    // Bind Dropzone & Upload Events
    const dropZone = container.querySelector("#drop-zone");
    const fileInput = container.querySelector("#file-input");
    const browseBtn = container.querySelector("#browse-btn");

    if (dropZone && fileInput) {
      dropZone.addEventListener("click", () => fileInput.click());
      browseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        fileInput.click();
      });

      fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          uploadFile(e.target.files[0]);
        }
      });

      dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "var(--primary)";
        dropZone.style.backgroundColor = "var(--primary-subtle)";
      });

      dropZone.addEventListener("dragleave", () => {
        dropZone.style.borderColor = "var(--border-medium)";
        dropZone.style.backgroundColor = "var(--bg-surface)";
      });

      dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "var(--border-medium)";
        dropZone.style.backgroundColor = "var(--bg-surface)";
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          uploadFile(e.dataTransfer.files[0]);
        }
      });
    }

    container.querySelector("#import-load-workflow-btn")?.addEventListener("click", () => loadSample("test_workflow.csv"));
    container.querySelector("#import-load-courses-btn")?.addEventListener("click", () => loadSample("test_courses.csv"));
    container.querySelector("#import-clean-btn")?.addEventListener("click", () => state.setTab("clean"));
    container.querySelector("#import-reset-btn")?.addEventListener("click", () => resetDataset());

    // Initialize Paginated Table
    const tableContainer = container.querySelector("#import-table-container");
    if (tableContainer && activeDatasetName) {
      tableInstance = new PaginatedTable(tableContainer, activeDatasetName, { pageSize: 25 });
      tableInstance.load();
    }
  }

  async function uploadFile(file) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      showToast("This application only accepts CSV files (.csv). Webpages (HTML), spreadsheets (Excel), or other formats are not supported.", "error", 6000);
      return;
    }

    try {
      showToast(`Uploading and inspecting '${file.name}'...`, "info");
      const res = await api.uploadCsv(file);
      await state.refreshDatasets(res.dataset_name);
      showToast(`'${file.name}' loaded successfully! (${res.information.rows} rows, ${res.information.columns} columns)`, "success");
    } catch (err) {
      showToast(`Upload failed: ${err.message}`, "error");
    }
  }

  async function loadSample(filename) {
    try {
      showToast(`Loading sample '${filename}'...`, "info");
      const res = await api.loadSample(filename);
      await state.refreshDatasets(res.dataset_name);
      showToast(`'${filename}' loaded successfully!`, "success");
    } catch (err) {
      showToast(`Failed to load sample: ${err.message}`, "error");
    }
  }

  async function resetDataset() {
    const name = state.activeDataset;
    if (!name) return;
    if (!confirm(`Are you sure you want to reset '${name}' to its original uploaded state? All transformations will be reverted.`)) {
      return;
    }
    try {
      await api.resetDataset(name);
      await state.refreshDatasets(name);
      showToast(`'${name}' has been reverted to original uploaded state.`, "success");
    } catch (err) {
      showToast(`Reset failed: ${err.message}`, "error");
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
