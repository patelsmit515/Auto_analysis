/**
 * Auto_analysis Data Cleaning and Transformations View
 */

import { state } from "../state.js";
import { api } from "../api.js";
import { renderStaticTable } from "../components/table.js";
import { showToast } from "../components/toasts.js";

export function initCleaningView(container) {
  let activeTool = "missing"; // missing | duplicates | rename | types | drop | filter | split | combine | datetime
  let lastTransformResult = null;

  function render() {
    const activeDatasetName = state.activeDataset;
    const details = state.activeDatasetDetails;

    if (!activeDatasetName || !details) {
      container.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">🧹</div>
            <h3 class="empty-state-title">No Active Dataset</h3>
            <p class="empty-state-text">Select or upload a dataset first to use cleaning and transformation tools.</p>
            <button class="btn btn-primary" id="clean-goto-dash">Go to Dashboard</button>
          </div>
        </div>`;
      container.querySelector("#clean-goto-dash")?.addEventListener("click", () => state.setTab("dashboard"));
      return;
    }

    const columns = details.information.column_names || [];
    const dataTypes = details.information.data_types || {};
    const missingByCol = details.information.missing_by_column || {};
    const duplicateRows = details.information.duplicate_rows || 0;

    container.innerHTML = `
      <!-- Active Dataset Header Bar -->
      <div class="card" style="padding: 12px 20px; display: flex; flex-direction: row; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div>
          <span style="font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Active Dataset:</span>
          <strong style="color: var(--primary); font-size: 15px; margin-left: 6px; font-family: var(--font-mono);">${escapeHtml(activeDatasetName)}</strong>
          <span class="badge badge-subtle" style="margin-left: 8px;">${details.information.rows} rows &bull; ${columns.length} cols</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-outline btn-sm" id="clean-reset-btn" title="Revert all changes to original uploaded file">Reset to Original</button>
        </div>
      </div>

      <!-- Cleaning Tool Navigation Pills -->
      <div class="clean-tabs">
        <button class="clean-tab-btn ${activeTool === "missing" ? "active" : ""}" data-tool="missing">Fill Missing Values</button>
        <button class="clean-tab-btn ${activeTool === "duplicates" ? "active" : ""}" data-tool="duplicates">Duplicate Rows (${duplicateRows})</button>
        <button class="clean-tab-btn ${activeTool === "rename" ? "active" : ""}" data-tool="rename">Rename Columns</button>
        <button class="clean-tab-btn ${activeTool === "types" ? "active" : ""}" data-tool="types">Change Data Types</button>
        <button class="clean-tab-btn ${activeTool === "drop" ? "active" : ""}" data-tool="drop">Drop Columns</button>
        <button class="clean-tab-btn ${activeTool === "filter" ? "active" : ""}" data-tool="filter">Filter Rows</button>
        <button class="clean-tab-btn ${activeTool === "split" ? "active" : ""}" data-tool="split">Split Text Columns</button>
        <button class="clean-tab-btn ${activeTool === "combine" ? "active" : ""}" data-tool="combine">Combine Columns</button>
        <button class="clean-tab-btn ${activeTool === "datetime" ? "active" : ""}" data-tool="datetime">Date &amp; Time</button>
      </div>

      <!-- Tool Configuration Card -->
      <div class="card">
        <div class="card-body">
          <div id="clean-tool-container">
            ${renderToolForm(activeTool, columns, dataTypes, missingByCol, duplicateRows)}
          </div>

          <!-- Common Workflow Controls: Save as New vs Apply directly -->
          <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-light); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
            <div style="display: flex; align-items: center; gap: 16px;">
              <label class="checkbox-group">
                <input type="checkbox" id="clean-save-as-new-chk" />
                <span>Save as a new dataset</span>
              </label>
              <div id="clean-save-as-name-wrap" style="display: none;">
                <input type="text" class="form-control" id="clean-new-name-input" placeholder="e.g. ${escapeHtml(activeDatasetName)}_cleaned" style="width: 220px; font-size: 12px; padding: 4px 8px;" />
              </div>
            </div>

            <div style="display: flex; gap: 10px;">
              <button class="btn btn-outline" id="clean-preview-btn">Preview Result</button>
              <button class="btn btn-primary" id="clean-apply-btn">Apply Transformation</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Before and After Comparison Preview -->
      <div class="card" id="clean-preview-section" style="${lastTransformResult ? "" : "display: none;"}">
        <div class="card-header">
          <div class="card-title-group">
            <h3>Before &amp; After Transformation Preview</h3>
            <p class="card-subtitle" id="clean-preview-summary-text">${lastTransformResult ? escapeHtml(lastTransformResult.message) : ""}</p>
          </div>
          <div style="display: flex; gap: 8px;">
            ${lastTransformResult && !lastTransformResult.applied ? `
              <button class="btn btn-outline btn-sm" id="clean-discard-preview-btn">Cancel / Discard Preview</button>
              <button class="btn btn-primary btn-sm" id="clean-confirm-apply-btn">Confirm and Apply to Working Dataset &rarr;</button>
            ` : `
              <button class="btn btn-outline btn-sm" id="clean-undo-btn" title="Revert this applied transformation">Undo Applied Change</button>
            `}
          </div>
        </div>
        <div class="card-body" style="padding: 16px;">
          <div class="diff-container">
            <div class="diff-box">
              <div class="diff-box-header before">
                <span>BEFORE TRANSFORMATION</span>
                <span id="diff-before-count">${lastTransformResult ? `${lastTransformResult.rows_before} rows` : ""}</span>
              </div>
              <div id="diff-before-table"></div>
            </div>

            <div class="diff-box">
              <div class="diff-box-header after">
                <span>AFTER TRANSFORMATION</span>
                <span id="diff-after-count">${lastTransformResult ? `${lastTransformResult.rows_after} rows` : ""}</span>
              </div>
              <div id="diff-after-table"></div>
            </div>
          </div>
        </div>
      </div>`;

    // Tool navigation tab click handlers
    container.querySelectorAll(".clean-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTool = btn.getAttribute("data-tool");
        render();
      });
    });

    // Save as new checkbox toggle
    const saveAsChk = container.querySelector("#clean-save-as-new-chk");
    const saveAsWrap = container.querySelector("#clean-save-as-name-wrap");
    const newNameInput = container.querySelector("#clean-new-name-input");
    if (saveAsChk && saveAsWrap) {
      saveAsChk.addEventListener("change", () => {
        saveAsWrap.style.display = saveAsChk.checked ? "block" : "none";
        if (saveAsChk.checked && newNameInput && !newNameInput.value) {
          newNameInput.value = `${activeDatasetName}_cleaned`;
        }
      });
    }

    // Attach dynamic form listeners based on active tool
    bindToolEvents(activeTool);

    // Apply & Preview buttons
    container.querySelector("#clean-preview-btn")?.addEventListener("click", () => executeTransformation(false));
    container.querySelector("#clean-apply-btn")?.addEventListener("click", () => executeTransformation(true));
    container.querySelector("#clean-confirm-apply-btn")?.addEventListener("click", () => executeTransformation(true));
    container.querySelector("#clean-reset-btn")?.addEventListener("click", () => resetDataset());

    container.querySelector("#clean-discard-preview-btn")?.addEventListener("click", () => {
      lastTransformResult = null;
      const previewSection = container.querySelector("#clean-preview-section");
      if (previewSection) previewSection.style.display = "none";
      showToast("Preview cancelled. Working dataset remains unchanged.", "info");
    });

    container.querySelector("#clean-undo-btn")?.addEventListener("click", async () => {
      try {
        const res = await api.undoDataset(activeDatasetName);
        lastTransformResult = null;
        showToast(res.message || "Transformation undone.", "success");
        await state.refreshDatasets(activeDatasetName);
        state.checkUndo();
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    // If we have previous transform result, render diff tables
    if (lastTransformResult) {
      renderDiffTables(lastTransformResult);
    }
  }

  function renderToolForm(tool, columns, dataTypes, missingByCol, duplicateRows) {
    switch (tool) {
      case "missing":
        return `
          <div style="display: flex; flex-direction: column; gap: 14px;">
            <p style="font-size: 13px; color: var(--text-muted);">
              Fill missing/null values in specific columns using standard statistical strategies or a custom constant.
            </p>
            <div class="form-row" style="align-items: flex-start;">
              <div class="form-group" style="flex: 1.5;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                  <label class="form-label" style="margin: 0;">Columns to Fill</label>
                  <div style="display: flex; gap: 6px;">
                    <button type="button" class="btn btn-outline btn-xs" id="btn-missing-select-all">Select all</button>
                    <button type="button" class="btn btn-outline btn-xs" id="btn-missing-select-none">Select none</button>
                  </div>
                </div>
                <div style="max-height: 160px; overflow-y: auto; border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 8px; background: var(--bg-surface);">
                  ${columns.map((c) => {
                    const count = missingByCol[c] || 0;
                    const color = count > 0 ? "var(--warning)" : "var(--text-light)";
                    return `
                    <label class="checkbox-group" style="padding: 3px 0;">
                      <input type="checkbox" name="missing-cols" value="${escapeHtml(c)}" ${count > 0 ? "checked" : ""} />
                      <span>${escapeHtml(c)} <small style="color: ${color};">(${count} missing)</small></span>
                    </label>`;
                  }).join("")}
                </div>
              </div>

              <div class="form-group" style="flex: 1;">
                <label class="form-label">Fill Strategy</label>
                <select class="form-select" id="missing-strategy">
                  <option value="mean">Mean (Average - Numeric columns only)</option>
                  <option value="median">Median (Middle value - Numeric only)</option>
                  <option value="mode">Mode (Most frequent value)</option>
                  <option value="constant">Constant Value</option>
                </select>
                <span class="form-hint">Note: Mean and Median require numeric columns and will validate types.</span>

                <div class="form-group" id="missing-constant-wrap" style="display: none; margin-top: 10px;">
                  <label class="form-label">Constant Value</label>
                  <input type="text" class="form-control" id="missing-constant-val" placeholder="e.g. 0 or 'Unknown'" />
                </div>
              </div>
            </div>
          </div>`;

      case "duplicates":
        return `
          <div style="display: flex; flex-direction: column; gap: 14px;">
            <p style="font-size: 13px; color: var(--text-muted);">
              Detect duplicate records across <strong>all columns</strong> or <strong>selected columns</strong> (e.g. uncheck <code>Student_ID</code> to detect duplicate students like S004 and S009 who have identical names, ages, and cities).
            </p>

            <div class="form-row" style="align-items: flex-start;">
              <!-- Columns to Check -->
              <div class="form-group" style="flex: 1.5;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                  <label class="form-label" style="margin: 0;">Columns to Determine Duplicates</label>
                  <div style="display: flex; gap: 6px;">
                    <button type="button" class="btn btn-outline btn-xs" id="btn-dup-select-all">Select all</button>
                    <button type="button" class="btn btn-outline btn-xs" id="btn-dup-select-none">Select none</button>
                  </div>
                </div>
                <div style="max-height: 160px; overflow-y: auto; border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 8px; background: var(--bg-surface);">
                  ${columns.map((c) => {
                    const isId = c.toLowerCase().includes("id");
                    return `
                    <label class="checkbox-group" style="padding: 3px 0;">
                      <input type="checkbox" name="dup-cols" value="${escapeHtml(c)}" ${isId ? "" : "checked"} />
                      <span>${escapeHtml(c)} ${isId ? '<small style="color: var(--text-light);">(ID)</small>' : ''}</span>
                    </label>`;
                  }).join("")}
                </div>
                <span class="form-hint">Uncheck unique IDs to identify matching records across real-world attributes.</span>
              </div>

              <!-- Keep Occurrence Selector & Preview Scan Button -->
              <div class="form-group" style="flex: 1;">
                <label class="form-label">Which Occurrence to Retain</label>
                <select class="form-select" id="dup-keep-strategy">
                  <option value="first">Retain First Occurrence (Drop later duplicates)</option>
                  <option value="last">Retain Last Occurrence (Drop earlier duplicates)</option>
                  <option value="none">Drop All Occurrences (Keep only truly unique rows)</option>
                </select>
                <span class="form-hint">Controls which duplicate record is preserved.</span>

                <div style="margin-top: 14px;">
                  <button type="button" class="btn btn-outline btn-sm" id="btn-scan-duplicates" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    🔍 Check &amp; Highlight Duplicate Rows
                  </button>
                </div>
              </div>
            </div>

            <!-- Duplicate Scan Feedback and Highlight Table -->
            <div id="dup-scan-results-box" style="display: none; padding: 12px; border: 1px solid var(--border-medium); border-radius: var(--radius-md); background: var(--bg-surface);"></div>
          </div>`;

      case "rename":
        return `
          <div style="display: flex; flex-direction: column; gap: 14px;">
            <p style="font-size: 13px; color: var(--text-muted);">
              Rename one or more columns in a single unified operation.
            </p>
            <div id="rename-rows-container" style="display: flex; flex-direction: column; gap: 10px;">
              <div class="form-row rename-row">
                <div class="form-group">
                  <label class="form-label">Current Column Name</label>
                  <select class="form-select rename-col-select">
                    ${columns.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">New Column Name</label>
                  <input type="text" class="form-control rename-new-name" placeholder="Enter new name" />
                </div>
                <div style="width: 44px; display: flex; align-items: flex-end; padding-bottom: 14px;">
                  <button class="btn btn-outline btn-sm remove-rename-row-btn" style="visibility: hidden;">&times;</button>
                </div>
              </div>
            </div>
            <div>
              <button class="btn btn-outline btn-sm" id="add-rename-row-btn">+ Add Another Column to Rename</button>
            </div>
          </div>`;

      case "types":
        return `
          <div style="display: flex; flex-direction: column; gap: 14px;">
            <p style="font-size: 13px; color: var(--text-muted);">
              Cast column data types to integer, float, string, or datetime. Clear validation errors are displayed when invalid values (such as non-numeric text) prevent conversion.
            </p>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Select Column</label>
                <select class="form-select" id="type-col-select">
                  ${columns.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)} (current: ${escapeHtml(dataTypes[c] || "str")})</option>`).join("")}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Target Data Type</label>
                <select class="form-select" id="type-target-select">
                  <option value="integer">Integer (Int64 with null support)</option>
                  <option value="float">Float (Floating point numbers)</option>
                  <option value="string">String (Text)</option>
                  <option value="datetime">Datetime (Parsed timestamp)</option>
                </select>
              </div>
            </div>
          </div>`;

      case "drop":
        return `
          <div style="display: flex; flex-direction: column; gap: 14px;">
            <p style="font-size: 13px; color: var(--text-muted);">
              Select multiple columns to remove from the dataset.
            </p>
            <div class="form-group">
              <label class="form-label">Choose Columns to Remove</label>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 12px; background: var(--bg-surface);">
                ${columns.map((c) => `
                  <label class="checkbox-group">
                    <input type="checkbox" name="drop-col-chk" value="${escapeHtml(c)}" />
                    <span>${escapeHtml(c)}</span>
                  </label>
                `).join("")}
              </div>
            </div>
          </div>`;

      case "filter":
        return `
          <div style="display: flex; flex-direction: column; gap: 14px;">
            <p style="font-size: 13px; color: var(--text-muted);">
              Filter rows using standard comparison operators. Numeric values are automatically matched against numeric columns.
            </p>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Column</label>
                <select class="form-select" id="filter-col-select">
                  ${columns.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
                </select>
              </div>
              <div class="form-group" style="width: 140px; flex: none;">
                <label class="form-label">Operator</label>
                <select class="form-select" id="filter-op-select">
                  <option value="==">== (Equals)</option>
                  <option value="!=">!= (Not Equal)</option>
                  <option value=">">&gt; (Greater Than)</option>
                  <option value="<">&lt; (Less Than)</option>
                  <option value=">=">&gt;= (Greater or Equal)</option>
                  <option value="<=">&lt;= (Less or Equal)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Filter Value</label>
                <input type="text" class="form-control" id="filter-val-input" placeholder="e.g. 80 or Surat" />
              </div>
            </div>
          </div>`;

      case "split":
        return `
          <div style="display: flex; flex-direction: column; gap: 14px;">
            <p style="font-size: 13px; color: var(--text-muted);">
              Split a text column into multiple distinct columns using single or multiple delimiters in a single operation (for example, splitting <code>Python;SQL,Excel</code> using both <code>;</code> and <code>,</code>).
            </p>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Source Column</label>
                <select class="form-select" id="split-source-col">
                  ${columns.map((c) => `<option value="${escapeHtml(c)}" ${c.toLowerCase().includes("skill") ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Separator Preset</label>
                <select class="form-select" id="split-sep-preset">
                  <option value="multi">Multiple Separators: Semicolon &amp; Comma ( ; and , )</option>
                  <option value=";">Semicolon ( ; )</option>
                  <option value=",">Comma ( , )</option>
                  <option value=" ">Space (   )</option>
                  <option value="-">Hyphen ( - )</option>
                  <option value="custom">Custom Separators / Regex</option>
                </select>
              </div>
              <div class="form-group" id="split-custom-sep-wrap" style="display: none;">
                <label class="form-label">Custom Separators (list or regex)</label>
                <input type="text" class="form-control" id="split-custom-sep-input" placeholder="e.g. ; , or [;,]" />
                <span class="form-hint">Enter multiple separators separated by spaces/commas, or check regex below.</span>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Output Column Names (Comma-separated)</label>
                <input type="text" class="form-control" id="split-new-cols-input" placeholder="e.g. Skill_1, Skill_2, Skill_3" />
                <span class="form-hint">Specify exact unique names for each split part. Leave blank to auto-generate '{col}_part_1', '{col}_part_2', etc.</span>
              </div>
              <div class="form-group" style="width: 220px; flex: none;">
                <label class="form-label">Maximum Splits</label>
                <input type="number" class="form-control" id="split-max-splits" value="-1" min="-1" />
                <span class="form-hint">-1 splits on every delimiter (safest &amp; simplest default). Enter 1 to split into 2 parts.</span>
              </div>
            </div>

            <div style="display: flex; gap: 20px; flex-wrap: wrap;">
              <label class="checkbox-group">
                <input type="checkbox" id="split-regex-chk" />
                <span>Treat custom separator as a Regular Expression</span>
              </label>
              <label class="checkbox-group">
                <input type="checkbox" id="split-keep-orig-chk" checked />
                <span>Retain original column in dataset</span>
              </label>
            </div>
          </div>`;

      case "combine":
        return `
          <div style="display: flex; flex-direction: column; gap: 14px;">
            <p style="font-size: 13px; color: var(--text-muted);">
              Combine multiple columns into a single target column with a custom separator. Missing values are omitted cleanly.
            </p>
            <div class="form-group">
              <label class="form-label">Select Columns to Combine (Ordered)</label>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 12px; background: var(--bg-surface);">
                ${columns.map((c) => `
                  <label class="checkbox-group">
                    <input type="checkbox" name="combine-col-chk" value="${escapeHtml(c)}" />
                    <span>${escapeHtml(c)}</span>
                  </label>
                `).join("")}
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">New Combined Column Name</label>
                <input type="text" class="form-control" id="combine-new-name" placeholder="e.g. Full_Address or Full_Name" />
              </div>
              <div class="form-group" style="width: 180px; flex: none;">
                <label class="form-label">Separator</label>
                <input type="text" class="form-control" id="combine-sep" value=" " placeholder="Space or comma" />
              </div>
            </div>
            <label class="checkbox-group">
              <input type="checkbox" id="combine-keep-orig-chk" checked />
              <span>Retain original source columns</span>
            </label>
          </div>`;

      case "datetime":
        return `
          <div style="display: flex; flex-direction: column; gap: 14px;">
            <p style="font-size: 13px; color: var(--text-muted);">
              Parse and transform date/time columns. Convert text to datetime format, or extract components into dedicated columns.
            </p>

            <!-- Operation Mode Toggle -->
            <div class="form-group">
              <label class="form-label">Operation Mode</label>
              <div style="display: flex; gap: 24px; padding: 6px 0;">
                <label class="checkbox-group">
                  <input type="radio" name="dt-mode" value="convert" checked id="dt-mode-convert" />
                  <span><strong>Convert column to Datetime</strong> (Parse timestamps)</span>
                </label>
                <label class="checkbox-group">
                  <input type="radio" name="dt-mode" value="extract" id="dt-mode-extract" />
                  <span><strong>Extract Date/Time Components</strong> (Year, Month, Day, etc.)</span>
                </label>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Date/Time Column</label>
                <select class="form-select" id="dt-col-select">
                  ${columns.map((c) => `<option value="${escapeHtml(c)}" ${c.toLowerCase().includes("date") || c.toLowerCase().includes("time") ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Format String (Optional)</label>
                <input type="text" class="form-control" id="dt-format-input" placeholder="Leave blank to auto-detect ISO &amp; standard formats" value="" />
                <span class="form-hint">Leave blank for automatic ISO &amp; standard format parsing.</span>
              </div>
              <div class="form-group" style="width: 270px; flex: none;">
                <label class="form-label">Invalid Dates Policy</label>
                <select class="form-select" id="dt-errors-select">
                  <option value="coerce" selected>Convert invalid values to missing values (Recommended)</option>
                  <option value="raise">Reject conversion (Preserve data &amp; report errors)</option>
                </select>
                <span class="form-hint">Recommended default converts invalid dates to missing (NaT).</span>
              </div>
            </div>

            <!-- Convert Mode Specific: Target Column -->
            <div id="dt-convert-options" class="form-group">
              <label class="form-label">Output Column (Optional)</label>
              <input type="text" class="form-control" id="dt-target-col-input" placeholder="Leave blank to convert in-place, or enter new column name" style="max-width: 380px;" />
            </div>

            <!-- Extract Mode Specific: Components Checkboxes -->
            <div id="dt-extract-options" style="display: none; flex-direction: column; gap: 12px;">
              <div class="form-group">
                <label class="form-label">Select Components to Extract</label>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 12px; background: var(--bg-surface);">
                  <label class="checkbox-group"><input type="checkbox" name="dt-part" value="year" checked /><span>Year</span></label>
                  <label class="checkbox-group"><input type="checkbox" name="dt-part" value="month" checked /><span>Month</span></label>
                  <label class="checkbox-group"><input type="checkbox" name="dt-part" value="day" checked /><span>Day</span></label>
                  <label class="checkbox-group"><input type="checkbox" name="dt-part" value="weekday" /><span>Weekday (0-6)</span></label>
                  <label class="checkbox-group"><input type="checkbox" name="dt-part" value="weekday_name" checked /><span>Weekday Name</span></label>
                  <label class="checkbox-group"><input type="checkbox" name="dt-part" value="month_name" /><span>Month Name</span></label>
                  <label class="checkbox-group"><input type="checkbox" name="dt-part" value="hour" /><span>Hour</span></label>
                  <label class="checkbox-group"><input type="checkbox" name="dt-part" value="minute" /><span>Minute</span></label>
                  <label class="checkbox-group"><input type="checkbox" name="dt-part" value="second" /><span>Second</span></label>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Prefix for Extracted Columns (Optional)</label>
                  <input type="text" class="form-control" id="dt-prefix-input" placeholder="e.g. Reg" />
                </div>
                <div class="form-group" style="display: flex; align-items: flex-end; padding-bottom: 8px;">
                  <label class="checkbox-group">
                    <input type="checkbox" id="dt-keep-orig-chk" checked />
                    <span>Retain original column</span>
                  </label>
                </div>
              </div>
            </div>
          </div>`;

      default:
        return `<p>Select a cleaning tool above.</p>`;
    }
  }

  function bindToolEvents(tool) {
    if (tool === "missing") {
      const strategySelect = container.querySelector("#missing-strategy");
      const constantWrap = container.querySelector("#missing-constant-wrap");
      if (strategySelect && constantWrap) {
        strategySelect.addEventListener("change", () => {
          constantWrap.style.display = strategySelect.value === "constant" ? "block" : "none";
        });
      }

      const selectAllBtn = container.querySelector("#btn-missing-select-all");
      const selectNoneBtn = container.querySelector("#btn-missing-select-none");
      if (selectAllBtn) {
        selectAllBtn.addEventListener("click", () => {
          container.querySelectorAll("input[name='missing-cols']").forEach((chk) => (chk.checked = true));
        });
      }
      if (selectNoneBtn) {
        selectNoneBtn.addEventListener("click", () => {
          container.querySelectorAll("input[name='missing-cols']").forEach((chk) => (chk.checked = false));
        });
      }
    }

    if (tool === "duplicates") {
      const dupSelectAll = container.querySelector("#btn-dup-select-all");
      const dupSelectNone = container.querySelector("#btn-dup-select-none");
      if (dupSelectAll) {
        dupSelectAll.addEventListener("click", () => {
          container.querySelectorAll("input[name='dup-cols']").forEach((chk) => (chk.checked = true));
        });
      }
      if (dupSelectNone) {
        dupSelectNone.addEventListener("click", () => {
          container.querySelectorAll("input[name='dup-cols']").forEach((chk) => (chk.checked = false));
        });
      }

      const scanBtn = container.querySelector("#btn-scan-duplicates");
      const resultsBox = container.querySelector("#dup-scan-results-box");
      if (scanBtn && resultsBox) {
        scanBtn.addEventListener("click", async () => {
          const checkedCols = Array.from(container.querySelectorAll("input[name='dup-cols']:checked")).map((i) => i.value);
          const keep = container.querySelector("#dup-keep-strategy").value;

          if (checkedCols.length === 0) {
            showToast("Please select at least one column to check for duplicates.", "warning");
            return;
          }

          resultsBox.style.display = "block";
          resultsBox.innerHTML = `<span style="color: var(--text-muted); font-size: 13px;">Scanning dataset for duplicates...</span>`;

          try {
            const res = await api.cleanDetectDuplicates({
              dataset_name: state.activeDataset,
              subset: checkedCols,
              keep,
            });

            const count = res.duplicate_count || 0;
            const dupRows = res.duplicate_rows || [];

            let html = `
              <div style="margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                <div>
                  <strong>Duplicate Scan Results:</strong>
                  <span class="badge ${count > 0 ? "badge-warning" : "badge-success"}" style="margin-left: 6px;">
                    ${count} duplicate row(s) to remove
                  </span>
                </div>
                <span style="font-size: 11.5px; color: var(--text-muted);">
                  Criteria: [${escapeHtml(checkedCols.join(", "))}] (keep ${keep})
                </span>
              </div>`;

            if (count > 0 && dupRows.length > 0) {
              html += `
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">
                  Below are records with identical values in the selected columns (${dupRows.length} matching rows shown):
                </p>
                <div style="max-height: 220px; overflow-y: auto;" id="dup-rows-table-wrap"></div>`;
            } else {
              html += `<p style="font-size: 12.5px; color: var(--success); margin: 0;">✓ No duplicate rows found matching the selected columns.</p>`;
            }

            resultsBox.innerHTML = html;

            if (count > 0 && dupRows.length > 0) {
              const wrap = resultsBox.querySelector("#dup-rows-table-wrap");
              if (wrap) {
                const cols = Object.keys(dupRows[0]).filter((k) => k !== "_row_index");
                renderStaticTable(wrap, cols, dupRows, 25);
              }
            }
          } catch (err) {
            resultsBox.innerHTML = `<span style="color: var(--danger);">Scan failed: ${escapeHtml(err.message)}</span>`;
          }
        });
      }
    }

    if (tool === "rename") {
      const addRowBtn = container.querySelector("#add-rename-row-btn");
      const rowsContainer = container.querySelector("#rename-rows-container");
      const columns = state.activeDatasetDetails?.information?.column_names || [];

      if (addRowBtn && rowsContainer) {
        addRowBtn.addEventListener("click", () => {
          const row = document.createElement("div");
          row.className = "form-row rename-row";
          row.innerHTML = `
            <div class="form-group">
              <label class="form-label">Current Column Name</label>
              <select class="form-select rename-col-select">
                ${columns.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">New Column Name</label>
              <input type="text" class="form-control rename-new-name" placeholder="Enter new name" />
            </div>
            <div style="width: 44px; display: flex; align-items: flex-end; padding-bottom: 14px;">
              <button class="btn btn-outline btn-sm remove-rename-row-btn" style="color: var(--danger);">&times;</button>
            </div>`;
          row.querySelector(".remove-rename-row-btn").addEventListener("click", () => row.remove());
          rowsContainer.appendChild(row);
        });
      }
    }

    if (tool === "split") {
      const sepPreset = container.querySelector("#split-sep-preset");
      const customWrap = container.querySelector("#split-custom-sep-wrap");
      const regexChk = container.querySelector("#split-regex-chk");

      function updateSplitVisibility() {
        const isCustom = sepPreset.value === "custom";
        const isRegex = regexChk.checked;
        if (customWrap) {
          customWrap.style.display = (isCustom || isRegex) ? "block" : "none";
        }
      }

      if (sepPreset) {
        sepPreset.addEventListener("change", updateSplitVisibility);
      }
      if (regexChk) {
        regexChk.addEventListener("change", () => {
          if (regexChk.checked && sepPreset.value !== "custom") {
            sepPreset.value = "custom";
          }
          updateSplitVisibility();
        });
      }
    }

    if (tool === "datetime") {
      const modeConvert = container.querySelector("#dt-mode-convert");
      const modeExtract = container.querySelector("#dt-mode-extract");
      const convertOptions = container.querySelector("#dt-convert-options");
      const extractOptions = container.querySelector("#dt-extract-options");

      function updateDtMode() {
        const isExtract = modeExtract && modeExtract.checked;
        if (convertOptions) convertOptions.style.display = isExtract ? "none" : "block";
        if (extractOptions) extractOptions.style.display = isExtract ? "flex" : "none";
      }

      if (modeConvert) modeConvert.addEventListener("change", updateDtMode);
      if (modeExtract) modeExtract.addEventListener("change", updateDtMode);
    }
  }

  async function executeTransformation(apply) {
    const datasetName = state.activeDataset;
    if (!datasetName) return;

    const saveAsChk = container.querySelector("#clean-save-as-new-chk")?.checked || false;
    const newNameInput = container.querySelector("#clean-new-name-input")?.value?.trim() || null;
    const saveAs = saveAsChk ? (newNameInput || `${datasetName}_cleaned`) : null;
    const totalColsCount = state.activeDatasetDetails?.information?.column_names?.length || 0;

    try {
      let result = null;

      switch (activeTool) {
        case "missing": {
          const checkedCols = Array.from(container.querySelectorAll("input[name='missing-cols']:checked")).map((i) => i.value);
          const strategy = container.querySelector("#missing-strategy").value;
          const fillValue = strategy === "constant" ? container.querySelector("#missing-constant-val").value : null;

          if (checkedCols.length === 0) {
            showToast("Please select at least one column to fill missing values.", "warning");
            return;
          }

          result = await api.cleanFillMissing({
            dataset_name: datasetName,
            columns: checkedCols,
            strategy,
            fill_value: fillValue,
            apply,
            save_as: saveAs,
          });
          break;
        }

        case "duplicates": {
          const checkedCols = Array.from(container.querySelectorAll("input[name='dup-cols']:checked")).map((i) => i.value);
          const keep = container.querySelector("#dup-keep-strategy").value;

          if (checkedCols.length === 0) {
            showToast("Please select at least one column to check for duplicates.", "warning");
            return;
          }

          if (apply && !confirm(`Confirm removing duplicate rows based on [${checkedCols.join(", ")}] keeping ${keep}?`)) {
            return;
          }

          result = await api.cleanRemoveDuplicates({
            dataset_name: datasetName,
            subset: checkedCols.length === totalColsCount ? null : checkedCols,
            keep,
            apply,
            save_as: saveAs,
          });
          break;
        }

        case "rename": {
          const mapping = {};
          container.querySelectorAll(".rename-row").forEach((row) => {
            const oldName = row.querySelector(".rename-col-select").value;
            const newName = row.querySelector(".rename-new-name").value.trim();
            if (newName && newName !== oldName) {
              mapping[oldName] = newName;
            }
          });

          if (Object.keys(mapping).length === 0) {
            showToast("Please enter at least one new column name.", "warning");
            return;
          }

          result = await api.cleanRenameColumns({
            dataset_name: datasetName,
            column_mapping: mapping,
            apply,
            save_as: saveAs,
          });
          break;
        }

        case "types": {
          const column = container.querySelector("#type-col-select").value;
          const dataType = container.querySelector("#type-target-select").value;

          result = await api.cleanConvertType({
            dataset_name: datasetName,
            column,
            data_type: dataType,
            apply,
            save_as: saveAs,
          });
          break;
        }

        case "drop": {
          const checkedCols = Array.from(container.querySelectorAll("input[name='drop-col-chk']:checked")).map((i) => i.value);
          if (checkedCols.length === 0) {
            showToast("Please select at least one column to drop.", "warning");
            return;
          }

          result = await api.cleanDropColumns({
            dataset_name: datasetName,
            columns: checkedCols,
            apply,
            save_as: saveAs,
          });
          break;
        }

        case "filter": {
          const column = container.querySelector("#filter-col-select").value;
          const operator = container.querySelector("#filter-op-select").value;
          const value = container.querySelector("#filter-val-input").value.trim();

          if (!value) {
            showToast("Please enter a filter value.", "warning");
            return;
          }

          result = await api.cleanFilterRows({
            dataset_name: datasetName,
            column,
            operator,
            value,
            apply,
            save_as: saveAs,
          });
          break;
        }

        case "split": {
          const column = container.querySelector("#split-source-col").value;
          const preset = container.querySelector("#split-sep-preset").value;
          const customSep = container.querySelector("#split-custom-sep-input")?.value?.trim();
          const regex = container.querySelector("#split-regex-chk").checked;
          const keepOriginal = container.querySelector("#split-keep-orig-chk").checked;
          const maxSplits = parseInt(container.querySelector("#split-max-splits").value, 10);
          const newColsRaw = container.querySelector("#split-new-cols-input").value.trim();
          const newColumns = newColsRaw ? newColsRaw.split(",").map((s) => s.trim()).filter(Boolean) : null;

          let separator = preset;
          if (preset === "multi") {
            separator = [";", ","];
          } else if (preset === "custom" || regex) {
            separator = customSep || "";
            if (!separator) {
              showToast("Separator pattern cannot be empty.", "warning");
              return;
            }
          }

          result = await api.cleanSplitColumn({
            dataset_name: datasetName,
            column,
            separator,
            new_columns: newColumns,
            regex,
            keep_original: keepOriginal,
            max_splits: isNaN(maxSplits) ? -1 : maxSplits,
            apply,
            save_as: saveAs,
          });
          break;
        }

        case "combine": {
          const checkedCols = Array.from(container.querySelectorAll("input[name='combine-col-chk']:checked")).map((i) => i.value);
          const newColumn = container.querySelector("#combine-new-name").value.trim();
          const separator = container.querySelector("#combine-sep").value;
          const keepOriginal = container.querySelector("#combine-keep-orig-chk").checked;

          if (checkedCols.length < 1) {
            showToast("Please select at least one column to combine.", "warning");
            return;
          }
          if (!newColumn) {
            showToast("Please enter a new combined column name.", "warning");
            return;
          }

          result = await api.cleanCombineColumns({
            dataset_name: datasetName,
            columns: checkedCols,
            new_column: newColumn,
            separator,
            keep_original: keepOriginal,
            apply,
            save_as: saveAs,
          });
          break;
        }

        case "datetime": {
          const isExtractMode = container.querySelector("#dt-mode-extract")?.checked;
          const column = container.querySelector("#dt-col-select").value;
          const dateFormat = container.querySelector("#dt-format-input").value.trim() || null;
          const errors = container.querySelector("#dt-errors-select").value;

          if (isExtractMode) {
            const parts = Array.from(container.querySelectorAll("input[name='dt-part']:checked")).map((i) => i.value);
            const prefix = container.querySelector("#dt-prefix-input").value.trim() || null;
            const keepOriginal = container.querySelector("#dt-keep-orig-chk").checked;

            if (parts.length === 0) {
              showToast("Please select at least one component to extract.", "warning");
              return;
            }

            result = await api.cleanExtractDatetime({
              dataset_name: datasetName,
              column,
              parts,
              prefix,
              keep_original: keepOriginal,
              date_format: dateFormat,
              apply,
              save_as: saveAs,
            });
          } else {
            const targetCol = container.querySelector("#dt-target-col-input")?.value?.trim() || null;
            result = await api.cleanConvertDatetime({
              dataset_name: datasetName,
              column,
              date_format: dateFormat,
              errors,
              new_column: targetCol,
              apply,
              save_as: saveAs,
            });
          }
          break;
        }
      }

      if (result) {
        lastTransformResult = result;
        showToast(result.message, "success");

        if (apply) {
          await state.refreshDatasets(result.dataset_name);
        } else {
          // Reveal the diff preview section
          const previewSection = container.querySelector("#clean-preview-section");
          if (previewSection) {
            previewSection.style.display = "flex";
            container.querySelector("#clean-preview-summary-text").textContent = result.message;
            container.querySelector("#diff-before-count").textContent = `${result.rows_before} rows`;
            container.querySelector("#diff-after-count").textContent = `${result.rows_after} rows`;
            renderDiffTables(result);
            previewSection.scrollIntoView({ behavior: "smooth" });
          }
        }
      }
    } catch (err) {
      showToast(`Transformation failed: ${err.message}`, "error", 6000);
    }
  }

  function renderDiffTables(result) {
    const beforeWrap = container.querySelector("#diff-before-table");
    const afterWrap = container.querySelector("#diff-after-table");
    const summaryWrap = container.querySelector("#clean-preview-summary-text");

    if (result.stats && summaryWrap) {
      summaryWrap.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div>${escapeHtml(result.message)}</div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;">
            <span class="badge badge-success">✓ Converted: ${result.stats.successfully_converted}</span>
            ${result.stats.invalid_values > 0 ? `<span class="badge badge-warning">⚠ Invalid (Coerced to Null): ${result.stats.invalid_values}</span>` : ""}
            ${result.stats.missing_values > 0 ? `<span class="badge badge-subtle">Blank / Missing: ${result.stats.missing_values}</span>` : ""}
            <span class="badge badge-primary">Total: ${result.stats.total_rows} rows</span>
          </div>
        </div>`;
    }

    if (beforeWrap && result.before_preview && result.before_preview.length > 0) {
      const beforeCols = Object.keys(result.before_preview[0]);
      renderStaticTable(beforeWrap, beforeCols, result.before_preview, 10);
    }

    if (afterWrap && result.after_preview && result.after_preview.length > 0) {
      const afterCols = Object.keys(result.after_preview[0]);
      renderStaticTable(afterWrap, afterCols, result.after_preview, 10);
    }
  }

  async function resetDataset() {
    const name = state.activeDataset;
    if (!name) return;
    if (!confirm(`Revert dataset '${name}' to its original state?`)) return;

    try {
      await api.resetDataset(name);
      lastTransformResult = null;
      await state.refreshDatasets(name);
      showToast(`Dataset '${name}' restored to original state.`, "success");
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
