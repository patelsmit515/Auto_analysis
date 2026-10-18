/**
 * Auto_analysis Relationships View
 * Validates Primary Key candidates (automated + manual) and Foreign Key integrity.
 */

import { state } from "../state.js";
import { api } from "../api.js";
import { showToast } from "../components/toasts.js";

export function initRelationshipsView(container) {
  function render() {
    const datasets = state.datasets;

    if (datasets.length < 1) {
      container.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">🔗</div>
            <h3 class="empty-state-title">No Datasets Available</h3>
            <p class="empty-state-text">Load multiple datasets (such as test_workflow.csv and test_courses.csv) to validate primary and foreign key relationships.</p>
            <div style="display: flex; gap: 10px; margin-top: 12px;">
              <button class="btn btn-primary" id="rel-load-both-btn">Load Workflow &amp; Courses</button>
            </div>
          </div>
        </div>`;
      container.querySelector("#rel-load-both-btn")?.addEventListener("click", () => loadBothTestFiles());
      return;
    }

    // Default select parent and child
    let parentDataset = datasets[0].name;
    let childDataset = datasets.length > 1 ? datasets[1].name : datasets[0].name;

    // Smart default: if test_courses and test_workflow are present, make test_courses parent and test_workflow child
    if (datasets.some((d) => d.name === "test_courses") && datasets.some((d) => d.name === "test_workflow")) {
      parentDataset = "test_courses";
      childDataset = "test_workflow";
    }

    container.innerHTML = `
      <!-- Header / Info Bar -->
      <div class="card" style="padding: 14px 20px; display: flex; flex-direction: row; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div>
          <h3 style="font-size: 15px; font-weight: 700; color: var(--text-main);">Relational Integrity Studio</h3>
          <p style="font-size: 12px; color: var(--text-muted);">Validate Primary Key uniqueness and verify Foreign Key integrity across session datasets</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-outline btn-sm" id="rel-load-samples-btn">+ Load Test Datasets</button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <!-- 1. Primary Key Validator Card -->
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h3>1. Primary Key Analysis</h3>
              <p class="card-subtitle">Automated eligibility evaluation and custom combination verification</p>
            </div>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Dataset to Inspect</label>
              <select class="form-select" id="pk-dataset-select">
                ${datasets.map((d) => `<option value="${escapeHtml(d.name)}" ${d.name === parentDataset ? "selected" : ""}>${escapeHtml(d.name)} (${d.rows} rows)</option>`).join("")}
              </select>
            </div>

            <!-- Automated Evaluation Container -->
            <div id="pk-auto-eval-container" style="margin-top: 12px;">
              <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 12.5px;">
                Evaluating candidate primary keys...
              </div>
            </div>

            <!-- Manual Custom Key Verification (Collapsible) -->
            <details style="margin-top: 16px; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 10px; background: var(--surface-bg);">
              <summary style="font-size: 12.5px; font-weight: 600; cursor: pointer; color: var(--text-main);">
                Verify Custom Column Combination
              </summary>
              <div style="margin-top: 10px;">
                <p style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 8px;">Select specific columns to test whether their combined values are non-null and unique:</p>
                <div id="pk-columns-container" style="max-height: 140px; overflow-y: auto; border: 1px solid var(--border-medium); border-radius: var(--radius-sm); padding: 8px; background: var(--card-bg);">
                  <!-- Dynamically populated -->
                </div>
                <button class="btn btn-outline btn-sm" id="pk-validate-btn" style="width: 100%; margin-top: 8px;">Check Selected Combination</button>
                <div id="pk-results-wrap" style="margin-top: 10px; display: none;"></div>
              </div>
            </details>
          </div>
        </div>

        <!-- 2. Foreign Key Reference Validator Card -->
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <h3>2. Foreign Key Reference Check</h3>
              <p class="card-subtitle">Ensure all child foreign keys exist in parent table</p>
            </div>
          </div>
          <div class="card-body">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Parent Table (Primary Key Table)</label>
                <select class="form-select" id="fk-parent-dataset">
                  ${datasets.map((d) => `<option value="${escapeHtml(d.name)}" ${d.name === parentDataset ? "selected" : ""}>${escapeHtml(d.name)}</option>`).join("")}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Parent Key Column</label>
                <select class="form-select" id="fk-parent-col">
                  <!-- Dynamically populated -->
                </select>
              </div>
            </div>

            <div class="form-row" style="margin-top: 8px;">
              <div class="form-group">
                <label class="form-label">Child Table (Foreign Key Table)</label>
                <select class="form-select" id="fk-child-dataset">
                  ${datasets.map((d) => `<option value="${escapeHtml(d.name)}" ${d.name === childDataset ? "selected" : ""}>${escapeHtml(d.name)}</option>`).join("")}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Child Foreign Key Column</label>
                <select class="form-select" id="fk-child-col">
                  <!-- Dynamically populated -->
                </select>
              </div>
            </div>

            <button class="btn btn-primary btn-sm" id="fk-validate-btn" style="width: 100%; margin-top: 12px;">Validate Foreign Key Reference</button>

            <!-- FK Results Output -->
            <div id="fk-results-wrap" style="margin-top: 16px; display: none;"></div>
          </div>
        </div>
      </div>`;

    // Populate columns based on current selectors
    const pkDatasetSelect = container.querySelector("#pk-dataset-select");
    const pkColumnsContainer = container.querySelector("#pk-columns-container");
    const fkParentDataset = container.querySelector("#fk-parent-dataset");
    const fkParentCol = container.querySelector("#fk-parent-col");
    const fkChildDataset = container.querySelector("#fk-child-dataset");
    const fkChildCol = container.querySelector("#fk-child-col");

    function updatePkColumns() {
      const selected = pkDatasetSelect.value;
      const dObj = datasets.find((d) => d.name === selected);
      const cols = dObj ? dObj.column_names || [] : [];

      if (pkColumnsContainer) {
        pkColumnsContainer.innerHTML = cols.map((c, idx) => `
          <label class="checkbox-group" style="padding: 3px 0;">
            <input type="checkbox" name="pk-col-chk" value="${escapeHtml(c)}" ${idx === 0 || c.toLowerCase().includes("id") ? "checked" : ""} />
            <span>${escapeHtml(c)}</span>
          </label>
        `).join("");
      }

      runAutoPkEvaluation(selected);
    }

    function updateFkParentColumns() {
      const selected = fkParentDataset.value;
      const dObj = datasets.find((d) => d.name === selected);
      const cols = dObj ? dObj.column_names || [] : [];

      fkParentCol.innerHTML = cols.map((c) => `
        <option value="${escapeHtml(c)}" ${c.toLowerCase().includes("id") ? "selected" : ""}>${escapeHtml(c)}</option>
      `).join("");
    }

    function updateFkChildColumns() {
      const selected = fkChildDataset.value;
      const dObj = datasets.find((d) => d.name === selected);
      const cols = dObj ? dObj.column_names || [] : [];

      fkChildCol.innerHTML = cols.map((c) => `
        <option value="${escapeHtml(c)}" ${c.toLowerCase().includes("id") ? "selected" : ""}>${escapeHtml(c)}</option>
      `).join("");
    }

    if (pkDatasetSelect) {
      pkDatasetSelect.addEventListener("change", updatePkColumns);
      updatePkColumns();
    }

    if (fkParentDataset) {
      fkParentDataset.addEventListener("change", updateFkParentColumns);
      updateFkParentColumns();
    }

    if (fkChildDataset) {
      fkChildDataset.addEventListener("change", updateFkChildColumns);
      updateFkChildColumns();
    }

    container.querySelector("#pk-validate-btn")?.addEventListener("click", () => runManualPkCheck());
    container.querySelector("#fk-validate-btn")?.addEventListener("click", () => runFkCheck());
    container.querySelector("#rel-load-samples-btn")?.addEventListener("click", () => loadBothTestFiles());
  }

  async function runAutoPkEvaluation(datasetName) {
    const evalWrap = container.querySelector("#pk-auto-eval-container");
    if (!evalWrap) return;

    try {
      evalWrap.innerHTML = `
        <div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 12px;">
          Evaluating candidate primary keys for <strong>${escapeHtml(datasetName)}</strong>...
        </div>`;

      const result = await api.evaluatePrimaryKeys(datasetName);
      const eligible = result.eligible_columns || [];
      const ineligible = result.ineligible_columns || [];
      const composite = result.composite_candidates || [];

      let html = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <!-- Domain Disclaimer Alert -->
          <div class="alert alert-info" style="font-size: 11.5px; padding: 10px 12px;">
            <span class="alert-icon">ℹ</span>
            <div class="alert-content">
              <strong>Domain Note:</strong> ${escapeHtml(result.disclaimer)}
            </div>
          </div>

          <!-- Eligible Columns -->
          <div>
            <div style="font-size: 12px; font-weight: 700; color: var(--text-main); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <span class="badge badge-success">✓ Eligible (${eligible.length})</span>
              <span>Single-Column Candidates</span>
            </div>
            ${eligible.length === 0 ? `
              <p style="font-size: 11.5px; color: var(--text-muted); font-style: italic;">No single column has 100% unique, non-null values across all rows.</p>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${eligible.map((item) => `
                  <div style="border: 1px solid #86efac; background: rgba(34, 197, 94, 0.08); border-radius: var(--radius-sm); padding: 8px 10px; display: flex; align-items: center; justify-content: space-between;">
                    <div>
                      <strong style="color: #15803d; font-size: 13px;">${escapeHtml(item.column)}</strong>
                      <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(item.description)}</div>
                    </div>
                    <span class="badge badge-success">${item.unique_count}/${item.total_rows} unique</span>
                  </div>
                `).join("")}
              </div>
            `}
          </div>

          <!-- Ineligible Columns with Reasons -->
          <div>
            <div style="font-size: 12px; font-weight: 700; color: var(--text-main); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <span class="badge badge-danger">✕ Ineligible (${ineligible.length})</span>
              <span>Columns with Duplicates or Missing Values</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; max-height: 150px; overflow-y: auto;">
              ${ineligible.map((item) => `
                <div style="border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 6px 10px; display: flex; align-items: center; justify-content: space-between; font-size: 12px; background: var(--surface-bg);">
                  <strong style="color: var(--text-main);">${escapeHtml(item.column)}</strong>
                  <span style="font-size: 11px; color: var(--danger);">Fails: ${escapeHtml(item.reason)}</span>
                </div>
              `).join("")}
            </div>
          </div>

          <!-- Composite Candidates (if any) -->
          ${composite.length > 0 ? `
            <div>
              <div style="font-size: 12px; font-weight: 700; color: var(--text-main); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                <span class="badge badge-info">🔗 Composite Candidate(s)</span>
                <span>Valid 2-Column Pairs</span>
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${composite.map((pair) => `
                  <span class="badge badge-subtle" style="font-size: 11.5px; padding: 4px 8px;">
                    (${pair.map(escapeHtml).join(" + ")})
                  </span>
                `).join("")}
              </div>
            </div>
          ` : ""}
        </div>`;

      evalWrap.innerHTML = html;
    } catch (err) {
      evalWrap.innerHTML = `<div class="alert alert-warning" style="font-size: 12px;">Failed to evaluate primary keys: ${escapeHtml(err.message)}</div>`;
    }
  }

  async function runManualPkCheck() {
    const dataset = container.querySelector("#pk-dataset-select").value;
    const checked = Array.from(container.querySelectorAll("input[name='pk-col-chk']:checked")).map((i) => i.value);
    const resultsWrap = container.querySelector("#pk-results-wrap");

    if (checked.length === 0) {
      showToast("Select at least one column for Primary Key check.", "warning");
      return;
    }

    try {
      const res = await api.checkPrimaryKey(dataset, checked);
      resultsWrap.style.display = "block";

      const isValid = res.valid;
      const hasMissing = res.has_missing_values;
      const hasDuplicates = res.has_duplicates;

      resultsWrap.innerHTML = `
        <div class="alert ${isValid ? "alert-success" : "alert-danger"}" style="padding: 10px 12px;">
          <span class="alert-icon">${isValid ? "✓" : "✕"}</span>
          <div class="alert-content">
            <div style="font-weight: 700; font-size: 13px; margin-bottom: 2px;">
              ${isValid ? "Valid Candidate Key" : "Invalid Candidate Key"}
            </div>
            <div style="font-size: 12px;">
              Columns: <strong>${res.columns.map(escapeHtml).join(", ")}</strong>
            </div>
            <ul style="margin: 4px 0 0 16px; font-size: 11.5px;">
              <li>Missing Values: <strong>${hasMissing ? `FAIL (${res.missing_count || 1} rows with nulls)` : "PASS (No nulls)"}</strong></li>
              <li>Duplicates: <strong>${hasDuplicates ? `FAIL (${res.duplicate_count || 1} duplicate rows)` : "PASS (Unique)"}</strong></li>
            </ul>
          </div>
        </div>`;

      showToast(isValid ? "Primary key combination PASSED." : "Primary key combination FAILED.", isValid ? "success" : "warning");
    } catch (err) {
      resultsWrap.style.display = "block";
      resultsWrap.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
      showToast(`PK Error: ${err.message}`, "error");
    }
  }

  async function runFkCheck() {
    const parentDataset = container.querySelector("#fk-parent-dataset").value;
    const parentCol = container.querySelector("#fk-parent-col").value;
    const childDataset = container.querySelector("#fk-child-dataset").value;
    const childCol = container.querySelector("#fk-child-col").value;
    const resultsWrap = container.querySelector("#fk-results-wrap");

    try {
      const res = await api.checkForeignKey(parentDataset, parentCol, childDataset, childCol);
      resultsWrap.style.display = "block";

      const isValid = res.valid;
      const missingValues = res.missing_values || [];

      resultsWrap.innerHTML = `
        <div class="alert ${isValid ? "alert-success" : "alert-warning"}">
          <span class="alert-icon">${isValid ? "✓" : "⚠"}</span>
          <div class="alert-content">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">
              ${isValid ? "Foreign Key Reference Verified" : "Orphan / Unmatched Values Found"}
            </div>
            <div style="font-size: 12.5px;">
              Child reference: <span class="badge badge-subtle"><strong>${escapeHtml(childDataset)}.${escapeHtml(childCol)}</strong></span>
              &rarr; Parent key: <span class="badge badge-subtle"><strong>${escapeHtml(parentDataset)}.${escapeHtml(parentCol)}</strong></span>
            </div>
            ${isValid ? `
              <p style="margin-top: 6px; font-size: 12px; color: var(--success);">All foreign key values in '${childDataset}' exist in parent table '${parentDataset}'.</p>
            ` : `
              <div style="margin-top: 10px;">
                <div style="font-size: 12px; font-weight: 600; color: #b91c1c; margin-bottom: 6px;">
                  Unmatched Values in Child Column <code>${escapeHtml(childCol)}</code> (${missingValues.length}):
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                  ${missingValues.map((v) => `
                    <span class="badge badge-danger" style="font-size: 12px; padding: 4px 8px;">
                      ${escapeHtml(v)} <span style="font-size: 10px; opacity: 0.8;">(missing from ${escapeHtml(parentDataset)}.${escapeHtml(parentCol)})</span>
                    </span>
                  `).join("")}
                </div>
              </div>
            `}
          </div>
        </div>`;

      showToast(isValid ? "Foreign key reference is valid." : `Found ${missingValues.length} unmatched foreign key(s).`, isValid ? "success" : "warning");
    } catch (err) {
      resultsWrap.style.display = "block";
      resultsWrap.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
      showToast(`FK Error: ${err.message}`, "error");
    }
  }

  async function loadBothTestFiles() {
    try {
      showToast("Loading test_workflow.csv and test_courses.csv...", "info");
      await api.loadSample("test_workflow.csv");
      await api.loadSample("test_courses.csv");
      await state.refreshDatasets("test_courses");
      showToast("Loaded both test datasets successfully.", "success");
    } catch (err) {
      showToast(`Failed loading samples: ${err.message}`, "error");
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
