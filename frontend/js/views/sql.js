/**
 * Auto_analysis SQL Analysis View
 * DuckDB local SQL engine with schema explorer, category-filtered references, and keyboard-friendly autocomplete.
 */

import { state } from "../state.js";
import { api } from "../api.js";
import { renderStaticTable } from "../components/table.js";
import { showToast } from "../components/toasts.js";

export function initSqlView(container) {
  let debounceTimer = null;
  let activeSuggestions = [];
  let selectedSuggestionIndex = -1;

  function render() {
    const datasets = state.datasets;
    const activeDataset = state.activeDataset || (datasets.length > 0 ? datasets[0].name : "dataset");

    // Starter query templates
    const templates = [
      { label: "Select All Rows", query: `SELECT * FROM ${activeDataset} LIMIT 10;` },
      { label: "Count Records & Groups", query: `SELECT COUNT(*) AS total_records FROM ${activeDataset};` },
      { label: "Group by Column with Count", query: `SELECT City, COUNT(*) AS student_count FROM ${activeDataset} GROUP BY City ORDER BY student_count DESC;` },
      { label: "Filter Numeric Column", query: `SELECT Full_Name, Score, City FROM ${activeDataset} WHERE Score > 80;` },
      { label: "Inner Join (if test_courses loaded)", query: `SELECT s.Student_ID, s.Full_Name, c.Course_Name, s.Score\nFROM test_workflow s\nJOIN test_courses c ON s.Course_ID = c.Course_ID;` },
    ];

    container.innerHTML = `
      <div class="sql-workspace-grid">
        <!-- Left: Query Editor & Results -->
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="card">
            <div class="card-header">
              <div class="card-title-group">
                <h3>SQL Query Editor</h3>
                <p class="card-subtitle">Execute fast local queries using DuckDB against current session datasets</p>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <select class="form-select" id="sql-templates-select" style="font-size: 12px; width: 190px; padding: 4px 8px;">
                  <option value="">&mdash; Starter Templates &mdash;</option>
                  ${templates.map((t, idx) => `<option value="${idx}">${escapeHtml(t.label)}</option>`).join("")}
                </select>
                <button class="btn btn-primary btn-sm" id="sql-run-btn" title="Run query (Ctrl + Enter)">▶ Run Query</button>
              </div>
            </div>

            <div class="card-body" style="padding: 16px; position: relative;">
              <div class="sql-editor-container">
                <textarea
                  id="sql-query-input"
                  class="form-control"
                  style="font-family: var(--font-mono); font-size: 13.5px; height: 240px; line-height: 1.5; background: var(--card-bg); color: var(--text-main); tab-size: 2;"
                  placeholder="SELECT * FROM ${escapeHtml(activeDataset)} LIMIT 10;"
                  spellcheck="false"
                >SELECT * FROM ${escapeHtml(activeDataset)} LIMIT 10;</textarea>

                <!-- Context-Aware Autocomplete Suggestions Popup -->
                <div id="sql-suggestions-box" class="sql-suggestions-dropdown"></div>
              </div>

              <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px; font-size: 11.5px; color: var(--text-muted); flex-wrap: wrap; gap: 8px;">
                <span>
                  Tip: Press <strong>Ctrl + Enter</strong> to execute. In autocomplete: <strong>Tab</strong> accepts suggestion, <strong>Enter</strong> inserts new line, <strong>Esc</strong> dismisses.
                </span>
                <span id="sql-execution-stat"></span>
              </div>
            </div>
          </div>

          <!-- Error Alert Banner (Hidden by default) -->
          <div id="sql-error-alert" class="alert alert-danger" style="display: none;">
            <span class="alert-icon">✕</span>
            <div class="alert-content" id="sql-error-message"></div>
          </div>

          <!-- Results Table Card -->
          <div class="card" id="sql-results-card">
            <div class="card-header">
              <div class="card-title-group">
                <h3>Query Results</h3>
                <p class="card-subtitle" id="sql-results-subtitle">Ready to run query</p>
              </div>
            </div>
            <div class="card-body" style="padding: 0;">
              <div id="sql-results-table-container">
                <div class="empty-state" style="padding: 36px 20px;">
                  <p class="empty-state-text">Execute a query above to inspect query results.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Current Session Schema Explorer & SQL Reference -->
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <!-- Current Session Schema -->
          <div class="card">
            <div class="card-header">
              <div class="card-title-group">
                <h3>Session Schema</h3>
                <p class="card-subtitle">Tables and columns in current session (click to insert)</p>
              </div>
            </div>
            <div class="card-body" style="padding: 12px; max-height: 320px; overflow-y: auto;">
              ${datasets.length === 0 ? `
                <p style="font-size: 12.5px; color: var(--text-muted); text-align: center; padding: 12px;">No tables registered in session. Upload a CSV to get started.</p>
              ` : datasets.map((d) => {
                const types = d.column_types || {};
                return `
                  <details open style="margin-bottom: 12px; border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 6px 8px; background: var(--surface-bg);">
                    <summary style="font-weight: 700; font-size: 12.5px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; user-select: none;">
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="color: var(--primary);">🗄 ${escapeHtml(d.name)}</span>
                        <span class="badge ${d.is_working_copy ? "badge-warning" : "badge-subtle"}" style="font-size: 10px;">
                          ${d.is_working_copy ? "Working Copy" : "Original"}
                        </span>
                      </div>
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <button class="btn btn-outline btn-xs insert-text-btn" data-text="${escapeHtml(d.name)}" title="Insert table name into query" style="font-size: 10px; padding: 2px 6px;">+ Table</button>
                        <span class="badge badge-subtle" style="font-size: 10px;">${d.rows}r &bull; ${d.columns}c</span>
                      </div>
                    </summary>

                    <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 4px; padding-left: 8px;">
                      ${(d.column_names || []).map((c) => {
                        const dtype = types[c] || "string";
                        return `
                          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; padding: 2px 0;">
                            <span class="schema-col-badge insert-text-btn" data-text="${escapeHtml(c)}" title="Insert '${escapeHtml(c)}' at cursor" style="cursor: pointer;">
                              ${escapeHtml(c)}
                            </span>
                            <span style="font-size: 10.5px; color: var(--text-muted); font-family: var(--font-mono);">${escapeHtml(dtype)}</span>
                          </div>
                        `;
                      }).join("")}
                    </div>
                  </details>
                `;
              }).join("")}
            </div>
          </div>

          <!-- SQL Syntax Reference -->
          <div class="card">
            <div class="card-header">
              <div class="card-title-group">
                <h3>SQL Reference</h3>
                <p class="card-subtitle">Searchable categories, syntax, and examples</p>
              </div>
            </div>
            <div class="card-body" style="padding: 12px; display: flex; flex-direction: column; gap: 10px;">
              <div style="display: flex; gap: 6px;">
                <select class="form-select" id="sql-ref-cat-select" style="font-size: 11.5px; padding: 4px 8px; width: 45%;">
                  <option value="all">All Categories</option>
                  <!-- Populated dynamically -->
                </select>
                <input type="text" class="form-control" id="sql-ref-search-input" placeholder="Search keywords..." style="font-size: 11.5px; padding: 4px 8px; flex: 1;" />
              </div>
              <div id="sql-ref-list-container" style="max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
                <!-- Dynamically populated -->
              </div>
            </div>
          </div>
        </div>
      </div>`;

    // Bind Query Editor Events
    const queryInput = container.querySelector("#sql-query-input");
    const runBtn = container.querySelector("#sql-run-btn");
    const templatesSelect = container.querySelector("#sql-templates-select");
    const suggestionsBox = container.querySelector("#sql-suggestions-box");
    const refSearchInput = container.querySelector("#sql-ref-search-input");
    const refCatSelect = container.querySelector("#sql-ref-cat-select");

    if (runBtn && queryInput) {
      runBtn.addEventListener("click", () => executeQuery(queryInput.value.trim()));

      queryInput.addEventListener("keydown", (e) => {
        // Ctrl+Enter or Cmd+Enter executes query
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          executeQuery(queryInput.value.trim());
          return;
        }

        const isSuggestionsOpen = suggestionsBox && suggestionsBox.style.display === "block";

        if (isSuggestionsOpen) {
          if (e.key === "Escape") {
            e.preventDefault();
            hideSuggestions();
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            navigateSuggestions(1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            navigateSuggestions(-1);
          } else if (e.key === "Tab") {
            // Tab accepts highlighted suggestion
            if (selectedSuggestionIndex >= 0 && activeSuggestions[selectedSuggestionIndex]) {
              e.preventDefault();
              applySuggestion(activeSuggestions[selectedSuggestionIndex]);
            }
          } else if (e.key === "Enter") {
            // Enter inserts a normal newline and dismisses suggestion list
            hideSuggestions();
            // Allow default behavior (newline insertion)
          }
        }
      });

      // Autocomplete suggestions as user types
      queryInput.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          fetchSuggestions(queryInput.value, queryInput.selectionStart);
        }, 180);
      });
    }

    if (templatesSelect && queryInput) {
      templatesSelect.addEventListener("change", () => {
        const idx = templatesSelect.value;
        if (idx !== "" && templates[idx]) {
          queryInput.value = templates[idx].query;
          queryInput.focus();
        }
      });
    }

    // Insert text buttons (table names and columns)
    container.querySelectorAll(".insert-text-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const text = btn.getAttribute("data-text");
        if (queryInput && text) {
          insertTextAtCursor(queryInput, text);
        }
      });
    });

    // Populate SQL Reference Categories
    initSqlReferenceControls(refCatSelect, refSearchInput);
  }

  async function initSqlReferenceControls(catSelect, searchInput) {
    if (!catSelect || !searchInput) return;

    try {
      const catRes = await api.getSqlReferenceCategories();
      const categories = catRes.categories || [];
      catSelect.innerHTML = `
        <option value="all">All Categories (${categories.length})</option>
        ${categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
      `;
    } catch {
      // Fallback
    }

    function doRefFilter() {
      const cat = catSelect.value;
      const term = searchInput.value.trim();
      loadSqlReferences(term, cat);
    }

    catSelect.addEventListener("change", doRefFilter);
    searchInput.addEventListener("input", doRefFilter);
    loadSqlReferences();
  }

  async function executeQuery(query) {
    if (!query) {
      showToast("Please enter a SQL query.", "warning");
      return;
    }

    const errorAlert = container.querySelector("#sql-error-alert");
    const errorMessage = container.querySelector("#sql-error-message");
    const tableContainer = container.querySelector("#sql-results-table-container");
    const statLabel = container.querySelector("#sql-execution-stat");
    const subtitle = container.querySelector("#sql-results-subtitle");

    if (errorAlert) errorAlert.style.display = "none";
    if (tableContainer) {
      tableContainer.innerHTML = `
        <div style="padding: 32px; text-align: center; color: var(--text-muted);">
          <div class="status-dot" style="margin: 0 auto 10px; width: 10px; height: 10px;"></div>
          Executing DuckDB SQL query...
        </div>`;
    }

    try {
      const result = await api.runSqlQuery(query);
      if (subtitle) {
        subtitle.textContent = `Returned ${result.row_count} row(s) in ${result.execution_time_ms} ms`;
      }
      if (statLabel) {
        statLabel.textContent = `⚡ ${result.execution_time_ms} ms &bull; ${result.row_count} rows`;
      }

      renderStaticTable(tableContainer, result.columns, result.rows, 500);
      showToast(`Query completed in ${result.execution_time_ms} ms (${result.row_count} rows)`, "success");
    } catch (err) {
      if (errorAlert && errorMessage) {
        errorMessage.textContent = err.message;
        errorAlert.style.display = "flex";
      }
      if (tableContainer) {
        tableContainer.innerHTML = `
          <div class="empty-state" style="padding: 32px;">
            <p class="empty-state-text" style="color: var(--danger);">Query failed. Inspect the error above.</p>
          </div>`;
      }
      showToast(`SQL Error: ${err.message}`, "error");
    }
  }

  async function fetchSuggestions(queryText, cursorPosition) {
    const suggestionsBox = container.querySelector("#sql-suggestions-box");
    if (!suggestionsBox) return;

    const textBeforeCursor = queryText.slice(0, cursorPosition);
    if (!textBeforeCursor.trim()) {
      hideSuggestions();
      return;
    }

    try {
      const schemas = state.getSchemaMap();
      const res = await api.getSqlSuggestions(textBeforeCursor, schemas);
      const suggestions = res.suggestions || [];

      if (suggestions.length === 0) {
        hideSuggestions();
        return;
      }

      activeSuggestions = suggestions;
      selectedSuggestionIndex = 0;

      suggestionsBox.innerHTML = suggestions.map((s, idx) => `
        <div class="suggestion-item ${idx === 0 ? "selected" : ""}" data-idx="${idx}">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="badge ${s.kind === "table" ? "badge-info" : s.kind === "column" ? "badge-primary" : "badge-subtle"}">${escapeHtml(s.kind)}</span>
            <strong>${escapeHtml(s.label)}</strong>
          </div>
          <span style="font-size: 11px; color: var(--text-muted);">${escapeHtml(s.detail || "")}</span>
        </div>
      `).join("");

      suggestionsBox.style.display = "block";

      // Attach click events on items
      suggestionsBox.querySelectorAll(".suggestion-item").forEach((item) => {
        item.addEventListener("mousedown", (e) => {
          e.preventDefault(); // Prevent blur
          const idx = parseInt(item.getAttribute("data-idx"), 10);
          if (activeSuggestions[idx]) {
            applySuggestion(activeSuggestions[idx]);
          }
        });
      });
    } catch {
      hideSuggestions();
    }
  }

  function applySuggestion(item) {
    const queryInput = container.querySelector("#sql-query-input");
    if (!queryInput) return;

    const pos = queryInput.selectionStart;
    const text = queryInput.value;

    // Find current token being typed
    const beforeCursor = text.slice(0, pos);
    const afterCursor = text.slice(pos);

    // Replace current partial word with chosen label
    const match = beforeCursor.match(/([A-Za-z0-9_.]+)$/);
    let newBefore = beforeCursor;
    if (match) {
      newBefore = beforeCursor.slice(0, beforeCursor.length - match[0].length);
    }

    queryInput.value = `${newBefore}${item.label} ${afterCursor}`;
    const newPos = newBefore.length + item.label.length + 1;
    queryInput.setSelectionRange(newPos, newPos);
    queryInput.focus();

    hideSuggestions();
  }

  function navigateSuggestions(dir) {
    const suggestionsBox = container.querySelector("#sql-suggestions-box");
    if (!suggestionsBox || activeSuggestions.length === 0) return;

    selectedSuggestionIndex = (selectedSuggestionIndex + dir + activeSuggestions.length) % activeSuggestions.length;
    suggestionsBox.querySelectorAll(".suggestion-item").forEach((item, idx) => {
      item.classList.toggle("selected", idx === selectedSuggestionIndex);
      if (idx === selectedSuggestionIndex) {
        item.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function hideSuggestions() {
    const suggestionsBox = container.querySelector("#sql-suggestions-box");
    if (suggestionsBox) {
      suggestionsBox.style.display = "none";
    }
    activeSuggestions = [];
    selectedSuggestionIndex = -1;
  }

  function insertTextAtCursor(input, text) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const val = input.value;
    input.value = val.substring(0, start) + text + val.substring(end);
    input.selectionStart = input.selectionEnd = start + text.length;
    input.focus();
  }

  async function loadSqlReferences(term = "", category = "") {
    const listWrap = container.querySelector("#sql-ref-list-container");
    if (!listWrap) return;

    try {
      const res = await api.getSqlReference(term, category);
      const items = res.references || [];

      if (items.length === 0) {
        listWrap.innerHTML = `<p style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 12px;">No matching syntax reference found.</p>`;
        return;
      }

      listWrap.innerHTML = items.map((item) => `
        <div style="border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 8px 10px; background: var(--surface-bg);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <strong style="color: var(--primary); font-size: 12.5px;">${escapeHtml(item.keyword)}</strong>
              <span class="badge badge-subtle" style="font-size: 10px;">${escapeHtml(item.category || "General")}</span>
            </div>
            <span style="font-size: 11px; color: var(--text-muted); text-align: right;">${escapeHtml(item.description)}</span>
          </div>
          <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-main); background: var(--card-bg); padding: 4px 6px; border-radius: 4px; border: 1px solid var(--border-light); margin-top: 4px; overflow-x: auto;">
            ${escapeHtml(item.syntax)}
          </div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">
            e.g. <code style="font-size: 10.5px;">${escapeHtml(item.example)}</code>
          </div>
        </div>
      `).join("");
    } catch {
      listWrap.innerHTML = `<p style="font-size: 12px; color: var(--danger);">Failed to load references.</p>`;
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
