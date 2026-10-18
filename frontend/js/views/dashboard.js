/**
 * Auto_analysis Dashboard View
 * Comprehensive Session Dataset Manager and On-Disk Saved Files Controller.
 */

import { state } from "../state.js";
import { api } from "../api.js";
import { showToast } from "../components/toasts.js";

export function initDashboardView(container) {
  let savedFilesData = { exports: [], root_data: [] };

  async function fetchSavedFiles() {
    try {
      savedFilesData = await api.getSavedFiles();
    } catch {
      savedFilesData = { exports: [], root_data: [] };
    }
  }

  async function render() {
    const activeDatasetName = state.activeDataset;
    const details = state.activeDatasetDetails;
    const datasets = state.datasets;

    await fetchSavedFiles();

    if (!activeDatasetName || !details) {
      container.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">📊</div>
            <h2 class="empty-state-title">Welcome to Auto_analysis</h2>
            <p class="empty-state-text">No dataset is currently loaded in your active session. Choose a sample dataset or upload your own CSV to begin analyzing.</p>
            <div style="display: flex; gap: 12px; margin-top: 16px; flex-wrap: wrap; justify-content: center;">
              <button class="btn btn-primary" id="dash-load-workflow-btn">Load test_workflow.csv</button>
              <button class="btn btn-outline" id="dash-load-courses-btn">Load test_courses.csv</button>
              <button class="btn btn-secondary" id="dash-goto-import-btn">Upload Custom CSV</button>
            </div>
          </div>
        </div>
        ${renderSavedFilesCard()}`;

      bindSavedFilesEvents();
      container.querySelector("#dash-load-workflow-btn")?.addEventListener("click", () => loadSample("test_workflow.csv"));
      container.querySelector("#dash-load-courses-btn")?.addEventListener("click", () => loadSample("test_courses.csv"));
      container.querySelector("#dash-goto-import-btn")?.addEventListener("click", () => state.setTab("import"));
      return;
    }

    const info = details.information || {};
    const validation = details.validation || { valid: true, errors: [], warnings: [] };
    const rows = info.rows || 0;
    const cols = info.columns || 0;
    const missingValues = info.missing_values || 0;
    const duplicateRows = info.duplicate_rows || 0;
    const qualitySummary = info.quality_summary || "Dataset loaded successfully.";

    // Render Loaded Datasets Badges & Manager List
    const datasetManagerRowsHtml = datasets.map((d) => {
      const isActive = d.name === activeDatasetName;
      const statusBadge = d.is_modified 
        ? `<span class="badge badge-warning" title="Working copy has transformations or cell edits">Working Copy</span>`
        : `<span class="badge badge-success" title="Original dataset state">Original</span>`;

      return `
        <tr style="${isActive ? 'background-color: var(--primary-subtle);' : ''}">
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 700; color: ${isActive ? 'var(--primary)' : 'var(--text-main)'}; font-size: 13.5px;">
                ${escapeHtml(d.name)}
              </span>
              ${isActive ? `<span class="badge badge-primary">ACTIVE</span>` : ''}
              ${statusBadge}
            </div>
          </td>
          <td>${d.rows.toLocaleString()} rows</td>
          <td>${d.columns} cols</td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 6px;">
              ${!isActive ? `<button class="btn btn-outline btn-xs btn-activate-ds" data-name="${escapeHtml(d.name)}">Select</button>` : ''}
              <button class="btn btn-outline btn-xs btn-rename-ds" data-name="${escapeHtml(d.name)}" title="Rename dataset">Rename</button>
              <button class="btn btn-danger btn-xs btn-remove-ds" data-name="${escapeHtml(d.name)}" data-modified="${d.is_modified}" title="Remove from active memory workspace">Remove from Session</button>
            </div>
          </td>
        </tr>`;
    }).join("");

    container.innerHTML = `
      <!-- Session Dataset Manager Card -->
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header">
          <div class="card-title-group">
            <h3>Active Session Workspace</h3>
            <p class="card-subtitle">Datasets currently held in local memory for this session (isolated and clean)</p>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-outline btn-sm" id="dash-clear-session-btn" style="color: var(--danger); border-color: var(--danger);" title="Remove all datasets from active memory workspace">Clear Entire Session</button>
            <button class="btn btn-outline btn-sm" id="dash-quick-sample-btn">+ Load Test Sample</button>
            <button class="btn btn-primary btn-sm" id="dash-quick-upload-btn">+ Upload CSV</button>
          </div>
        </div>
        <div class="card-body" style="padding: 0;">
          <table class="data-table" style="width: 100%;">
            <thead>
              <tr>
                <th>Dataset Name &amp; Status</th>
                <th>Rows</th>
                <th>Columns</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${datasetManagerRowsHtml}
            </tbody>
          </table>
        </div>
        <div class="card-footer" style="font-size: 11.5px; color: var(--text-muted); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <span>ℹ️ <strong>In-Memory Isolation:</strong> Session datasets exist only in local memory. Removing a dataset deregisters it from DuckDB and autocomplete immediately.</span>
          <span>${datasets.length} active dataset(s)</span>
        </div>
      </div>

      <!-- Key Metrics Row -->
      <div class="stats-grid">
        <div class="stat-card primary">
          <div class="stat-header">
            <span class="stat-title">Total Records</span>
            <span class="stat-icon">📄</span>
          </div>
          <div class="stat-value">${rows.toLocaleString()}</div>
          <div class="stat-desc">Rows in active dataset '${escapeHtml(activeDatasetName)}'</div>
        </div>

        <div class="stat-card info">
          <div class="stat-header">
            <span class="stat-title">Dimensions</span>
            <span class="stat-icon">📐</span>
          </div>
          <div class="stat-value">${cols}</div>
          <div class="stat-desc">Columns / Attributes</div>
        </div>

        <div class="stat-card ${missingValues > 0 ? "warning" : "success"}">
          <div class="stat-header">
            <span class="stat-title">Missing Cells</span>
            <span class="stat-icon">⚠️</span>
          </div>
          <div class="stat-value">${missingValues}</div>
          <div class="stat-desc">${((missingValues / Math.max(1, rows * cols)) * 100).toFixed(1)}% of total cells</div>
        </div>

        <div class="stat-card ${duplicateRows > 0 ? "warning" : "success"}">
          <div class="stat-header">
            <span class="stat-title">Duplicates</span>
            <span class="stat-icon">👥</span>
          </div>
          <div class="stat-value">${duplicateRows}</div>
          <div class="stat-desc">${rows > 0 ? ((duplicateRows / rows) * 100).toFixed(1) : 0}% identical row matches</div>
        </div>
      </div>

      <!-- Data Quality & Validation Overview -->
      <div class="card" style="margin-top: 20px;">
        <div class="card-header">
          <div class="card-title-group">
            <h3>Active Dataset Health &amp; Column Types</h3>
            <p class="card-subtitle">${escapeHtml(qualitySummary)}</p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-outline btn-sm" id="dash-inspect-btn">Open Data Table</button>
            <button class="btn btn-primary btn-sm" id="dash-clean-btn">Clean Dataset</button>
            <button class="btn btn-secondary btn-sm" id="dash-sql-btn">SQL Studio</button>
          </div>
        </div>
        <div class="card-body">
          ${validation.warnings && validation.warnings.length > 0 ? `
            <div class="alert alert-warning" style="margin-bottom: 16px;">
              <span class="alert-icon">⚠️</span>
              <div class="alert-content">
                <strong>Attention items detected:</strong>
                <ul style="margin: 4px 0 0 16px; font-size: 12.5px;">
                  ${validation.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}
                </ul>
              </div>
            </div>
          ` : `
            <div class="alert alert-success" style="margin-bottom: 16px;">
              <span class="alert-icon">✓</span>
              <div class="alert-content">Dataset passed validation checks with zero critical structural defects.</div>
            </div>
          `}

          <!-- Column Summary Table -->
          <div style="max-height: 260px; overflow-y: auto; border: 1px solid var(--border-light); border-radius: var(--radius-md);">
            <table class="data-table" style="width: 100%;">
              <thead>
                <tr>
                  <th>Column Name</th>
                  <th>Inferred Type</th>
                  <th>Missing Count</th>
                  <th>Missing %</th>
                  <th>Unique Values</th>
                </tr>
              </thead>
              <tbody>
                ${(info.column_names || []).map((col) => {
                  const dtype = (info.data_types && info.data_types[col]) || "unknown";
                  const missingCount = (info.missing_by_column && info.missing_by_column[col]) || 0;
                  const missingPct = (info.missing_percentage_by_column && info.missing_percentage_by_column[col]) || 0;
                  const uniqueCount = (info.unique_values_by_column && info.unique_values_by_column[col]) || 0;
                  return `
                    <tr>
                      <td style="font-weight: 600;">${escapeHtml(col)}</td>
                      <td><span class="badge badge-type">${escapeHtml(dtype)}</span></td>
                      <td style="${missingCount > 0 ? 'color: var(--warning); font-weight: 600;' : ''}">${missingCount}</td>
                      <td>${missingPct.toFixed(1)}%</td>
                      <td>${uniqueCount.toLocaleString()}</td>
                    </tr>`;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Saved Files on Disk Card (Distinct from Session Memory) -->
      ${renderSavedFilesCard()}`;

    bindDatasetManagerEvents();
    bindSavedFilesEvents();
  }

  function renderSavedFilesCard() {
    const exports = savedFilesData.exports || [];
    const rootData = savedFilesData.root_data || [];

    const formatBytes = (bytes) => {
      if (bytes === 0) return "0 Bytes";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    return `
      <div class="card" style="margin-top: 20px;">
        <div class="card-header">
          <div class="card-title-group">
            <h3>Saved Files on Disk (Managed Copies)</h3>
            <p class="card-subtitle">Permanent CSV files on your machine. Distinct from in-memory session datasets.</p>
          </div>
          <button class="btn btn-outline btn-sm" id="dash-refresh-files-btn">↻ Refresh Files</button>
        </div>
        <div class="card-body" style="padding: 0;">
          <table class="data-table" style="width: 100%;">
            <thead>
              <tr>
                <th>File Name &amp; Storage Folder</th>
                <th>File Size</th>
                <th style="text-align: right;">Storage Actions</th>
              </tr>
            </thead>
            <tbody>
              ${exports.length === 0 && rootData.length === 0 ? `
                <tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 20px;">No saved files found in data/ folder.</td></tr>
              ` : `
                ${exports.map((f) => `
                  <tr>
                    <td>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-weight: 600; color: var(--text-main);">${escapeHtml(f.filename)}</span>
                        <span class="badge badge-subtle">data/exports/</span>
                      </div>
                    </td>
                    <td>${formatBytes(f.size_bytes)}</td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; gap: 6px;">
                        <button class="btn btn-outline btn-xs btn-load-file" data-folder="exports" data-filename="${escapeHtml(f.filename)}">Load into Session</button>
                        <button class="btn btn-danger btn-xs btn-delete-file" data-folder="exports" data-filename="${escapeHtml(f.filename)}">Delete Permanently</button>
                      </div>
                    </td>
                  </tr>
                `).join("")}
                ${rootData.map((f) => `
                  <tr>
                    <td>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-weight: 600; color: var(--text-main);">${escapeHtml(f.filename)}</span>
                        <span class="badge badge-info">data/</span>
                      </div>
                    </td>
                    <td>${formatBytes(f.size_bytes)}</td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; gap: 6px;">
                        <button class="btn btn-outline btn-xs btn-load-file" data-folder="root" data-filename="${escapeHtml(f.filename)}">Load into Session</button>
                        ${f.filename.startsWith("cleaned_") ? `
                          <button class="btn btn-danger btn-xs btn-delete-file" data-folder="root" data-filename="${escapeHtml(f.filename)}">Delete Permanently</button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `).join("")}
              `}
            </tbody>
          </table>
        </div>
        <div class="card-footer" style="font-size: 11.5px; color: var(--text-muted);">
          <span>⚠️ <strong>Permanent Deletion:</strong> 'Delete Permanently' safely removes the file from your local disk with strict path confirmation. 'Remove from Session' only clears it from memory.</span>
        </div>
      </div>`;
  }

  function bindDatasetManagerEvents() {
    container.querySelectorAll(".btn-activate-ds").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.getAttribute("data-name");
        state.setActiveDataset(name);
      });
    });

    container.querySelectorAll(".btn-rename-ds").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const name = btn.getAttribute("data-name");
        const newName = prompt(`Enter new name for dataset '${name}':`, name);
        if (newName && newName.trim() && newName.trim() !== name) {
          try {
            const res = await api.renameDataset(name, newName.trim());
            showToast(res.message || `Dataset renamed to '${res.new_name}'.`, "success");
            await state.refreshDatasets(res.new_name);
          } catch (err) {
            showToast(err.message, "error");
          }
        }
      });
    });

    container.querySelectorAll(".btn-remove-ds").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const name = btn.getAttribute("data-name");
        const isModified = btn.getAttribute("data-modified") === "true";
        const msg = isModified
          ? `Dataset '${name}' has modifications or cell edits.\nAre you sure you want to remove it from this session? (Files on disk will remain untouched)`
          : `Remove dataset '${name}' from active session workspace?`;

        if (confirm(msg)) {
          try {
            await api.deleteDataset(name);
            showToast(`Dataset '${name}' removed from session.`, "info");
            await state.refreshDatasets();
          } catch (err) {
            showToast(err.message, "error");
          }
        }
      });
    });

    container.querySelector("#dash-clear-session-btn")?.addEventListener("click", async () => {
      if (confirm("Are you sure you want to clear ALL datasets from your active workspace session?\nAny unsaved transformations will be lost. (Files on disk will not be deleted)")) {
        try {
          await api.clearSession();
          showToast("Workspace session cleared. All active datasets removed.", "info");
          await state.refreshDatasets();
        } catch (err) {
          showToast(`Clear session failed: ${err.message}`, "error");
        }
      }
    });

    container.querySelector("#dash-quick-sample-btn")?.addEventListener("click", () => promptLoadSample());
    container.querySelector("#dash-quick-upload-btn")?.addEventListener("click", () => state.setTab("import"));
    container.querySelector("#dash-inspect-btn")?.addEventListener("click", () => state.setTab("import"));
    container.querySelector("#dash-clean-btn")?.addEventListener("click", () => state.setTab("clean"));
    container.querySelector("#dash-sql-btn")?.addEventListener("click", () => state.setTab("sql"));
  }

  function bindSavedFilesEvents() {
    container.querySelector("#dash-refresh-files-btn")?.addEventListener("click", async () => {
      await render();
      showToast("Refreshed saved files list.", "info");
    });

    container.querySelectorAll(".btn-load-file").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const filename = btn.getAttribute("data-filename");
        const folder = btn.getAttribute("data-folder");
        const target = folder === "exports" ? `exports/${filename}` : filename;
        await loadSample(target);
      });
    });

    container.querySelectorAll(".btn-delete-file").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const filename = btn.getAttribute("data-filename");
        const folder = btn.getAttribute("data-folder");
        if (confirm(`Are you sure you want to permanently delete '${filename}' from disk (${folder})?\nThis action cannot be undone.`)) {
          try {
            const res = await api.deleteSavedFile(filename, folder);
            showToast(res.message || `File '${filename}' deleted.`, "success");
            await render();
          } catch (err) {
            showToast(`Delete failed: ${err.message}`, "error");
          }
        }
      });
    });
  }

  async function loadSample(filename) {
    try {
      showToast(`Loading sample dataset '${filename}'...`, "info");
      const res = await api.loadSample(filename);
      await state.refreshDatasets(res.dataset_name);
      showToast(`Loaded '${filename}' successfully into session.`, "success");
    } catch (err) {
      showToast(`Failed to load sample: ${err.message}`, "error");
    }
  }

  async function promptLoadSample() {
    try {
      const res = await api.getAvailableSamples();
      const samples = res.samples || [];
      if (samples.length === 0) {
        showToast("No sample files found in data/ folder.", "warning");
        return;
      }
      const choice = prompt(`Enter sample file to load:\n${samples.join(", ")}`, samples[0]);
      if (choice) {
        await loadSample(choice.trim());
      }
    } catch (err) {
      showToast(`Could not list samples: ${err.message}`, "error");
    }
  }

  // Subscribe to state changes
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
