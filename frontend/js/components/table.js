/**
 * Auto_analysis Table Component
 * Renders data tables with sticky headers, horizontal scrolling, pagination, and null cell formatting.
 */

import { api } from "../api.js";
import { state } from "../state.js";
import { showToast } from "./toasts.js";

function escapeHtml(val) {
  if (val === null || val === undefined) return '<span class="cell-null">null</span>';
  const str = String(val);
  return str.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

/**
 * Render a simple preview table for rows (in-memory)
 */
export function renderStaticTable(container, columns, rows, maxRows = 100) {
  if (!container) return;
  if (!columns || columns.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 24px;">
        <p class="empty-state-text">No data to display</p>
      </div>`;
    return;
  }

  const displayRows = rows ? rows.slice(0, maxRows) : [];

  let html = `
    <div class="table-wrapper">
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 48px; text-align: center; color: var(--text-light);">#</th>
              ${columns.map((c) => `<th><div class="th-content"><span class="th-name">${escapeHtml(c)}</span></div></th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${displayRows.length === 0 ? `
              <tr><td colspan="${columns.length + 1}" style="text-align: center; padding: 20px; color: var(--text-muted);">No records found</td></tr>
            ` : displayRows.map((row, idx) => `
              <tr>
                <td style="text-align: center; color: var(--text-light); font-size: 11px;">${idx + 1}</td>
                ${columns.map((c) => `<td>${escapeHtml(row[c])}</td>`).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <div class="table-pagination">
        <span>Showing ${displayRows.length} ${rows.length > maxRows ? `of ${rows.length}` : ""} rows</span>
      </div>
    </div>`;

  container.innerHTML = html;
}

/**
 * Server-backed interactive paginated table with Excel-like inline cell editing
 */
export class PaginatedTable {
  constructor(container, datasetName, options = {}) {
    this.container = container;
    this.datasetName = datasetName;
    this.pageSize = options.pageSize || 25;
    this.currentPage = 1;
    this.searchQuery = "";
    this.totalRows = 0;
    this.totalPages = 1;
    this.dataTypes = {};
    this.editingCell = null;
  }

  async load() {
    this.container.innerHTML = `
      <div style="padding: 32px; text-align: center; color: var(--text-muted);">
        <div class="status-dot" style="margin: 0 auto 12px; width: 12px; height: 12px;"></div>
        Loading dataset records...
      </div>`;

    try {
      const data = await api.getDatasetData(
        this.datasetName,
        this.currentPage,
        this.pageSize,
        this.searchQuery
      );

      this.totalRows = data.total_rows;
      this.totalPages = data.total_pages;
      this.columns = data.column_names || [];
      this.dataTypes = data.data_types || {};
      this.rows = data.rows || [];

      this.render();
      this.updateUndoStatus();
    } catch (err) {
      const isConnectionErr = err.status === 0 || err.message.toLowerCase().includes("unable to reach") || err.message.toLowerCase().includes("fetch");
      const is404 = err.status === 404 || err.message.toLowerCase().includes("not found");

      let msg = err.message;
      if (isConnectionErr) {
        msg = "The local backend server is unreachable. Please verify that 'uvicorn backend.app:app --port 8000' is running.";
      } else if (is404) {
        msg = `Dataset '${this.datasetName}' was not found in the active session. It may have been removed or renamed.`;
      }

      this.container.innerHTML = `
        <div class="alert alert-danger" style="margin: 16px;">
          <span class="alert-icon">✕</span>
          <div class="alert-content">
            <strong>Could not load table data</strong>
            <p style="margin-top: 4px; font-size: 12px;">${escapeHtml(msg)}</p>
          </div>
        </div>`;
    }
  }

  async updateUndoStatus() {
    try {
      const undoRes = await api.canUndoDataset(this.datasetName);
      const undoBtn = this.container.querySelector("#tbl-undo-btn");
      if (undoBtn) {
        undoBtn.style.display = undoRes && undoRes.can_undo ? "inline-flex" : "none";
      }
    } catch {
      // Ignore
    }
  }

  render() {
    const startRecord = this.totalRows === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
    const endRecord = Math.min(this.currentPage * this.pageSize, this.totalRows);

    this.container.innerHTML = `
      <div class="table-wrapper">
        <div style="padding: 10px 16px; border-bottom: 1px solid var(--border-light); background: var(--bg-surface); display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="text" class="form-control" placeholder="Search rows (e.g. S001, Aman)..." value="${escapeHtml(this.searchQuery).replace(/<[^>]+>/g, '')}" style="width: 240px; font-size: 12px; padding: 5px 10px;" id="tbl-search-input">
            <button class="btn btn-primary btn-sm" id="tbl-do-search">Search</button>
            ${this.searchQuery ? `<button class="btn btn-outline btn-sm" id="tbl-clear-search">Clear</button>` : ""}
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 11px; color: var(--text-light); display: inline-flex; align-items: center; gap: 4px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              Double-click cell to edit
            </span>
            <button class="btn btn-outline btn-sm" id="tbl-undo-btn" style="display: none; align-items: center; gap: 4px;" title="Undo last change on this dataset">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
              Undo
            </button>
            <div style="font-size: 12px; color: var(--text-muted);">
              Total: <strong>${this.totalRows.toLocaleString()}</strong> rows &bull; <strong>${this.columns.length}</strong> columns
            </div>
          </div>
        </div>

        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 48px; text-align: center; color: var(--text-light);">#</th>
                ${this.columns.map((c) => {
                  const dtype = this.dataTypes[c] || "";
                  return `
                    <th>
                      <div class="th-content">
                        <span class="th-name">${escapeHtml(c)}</span>
                        ${dtype ? `<span class="badge-type">${escapeHtml(dtype)}</span>` : ""}
                      </div>
                    </th>`;
                }).join("")}
              </tr>
            </thead>
            <tbody>
              ${this.rows.length === 0 ? `
                <tr><td colspan="${this.columns.length + 1}" style="text-align: center; padding: 28px; color: var(--text-muted);">No records match your search criteria</td></tr>
              ` : this.rows.map((row, idx) => {
                const actualRowIdx = row._row_index !== undefined ? row._row_index : (startRecord + idx - 1);
                return `
                  <tr data-row="${actualRowIdx}">
                    <td style="text-align: center; color: var(--text-light); font-size: 11px;">${startRecord + idx}</td>
                    ${this.columns.map((c) => {
                      const val = row[c];
                      const isNull = val === null || val === undefined;
                      const rawString = isNull ? "" : String(val);
                      return `
                        <td class="editable-cell" data-col="${escapeHtml(c)}" data-row="${actualRowIdx}" data-raw="${escapeHtml(rawString)}" title="Double-click to edit">
                          ${escapeHtml(val)}
                        </td>`;
                    }).join("")}
                  </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>

        <div class="table-pagination">
          <span>Showing <strong>${startRecord}-${endRecord}</strong> of <strong>${this.totalRows.toLocaleString()}</strong> rows</span>
          <div class="pagination-controls">
            <button class="btn btn-outline btn-sm" id="tbl-prev" ${this.currentPage <= 1 ? "disabled" : ""}>&larr; Prev</button>
            <span style="font-size: 12px; font-weight: 600; padding: 0 4px;">Page ${this.currentPage} of ${this.totalPages}</span>
            <button class="btn btn-outline btn-sm" id="tbl-next" ${this.currentPage >= this.totalPages ? "disabled" : ""}>Next &rarr;</button>
          </div>
        </div>
      </div>`;

    // Bind Pagination Events
    const prevBtn = this.container.querySelector("#tbl-prev");
    const nextBtn = this.container.querySelector("#tbl-next");
    const searchInput = this.container.querySelector("#tbl-search-input");
    const doSearchBtn = this.container.querySelector("#tbl-do-search");
    const clearBtn = this.container.querySelector("#tbl-clear-search");
    const undoBtn = this.container.querySelector("#tbl-undo-btn");

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.load();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        if (this.currentPage < this.totalPages) {
          this.currentPage++;
          this.load();
        }
      });
    }

    const triggerSearch = () => {
      this.searchQuery = searchInput.value.trim();
      this.currentPage = 1;
      this.load();
    };

    if (searchInput) {
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          triggerSearch();
        }
      });
    }

    if (doSearchBtn) {
      doSearchBtn.addEventListener("click", triggerSearch);
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        this.searchQuery = "";
        this.currentPage = 1;
        this.load();
      });
    }

    if (undoBtn) {
      undoBtn.addEventListener("click", async () => {
        try {
          const res = await api.undoDataset(this.datasetName);
          showToast(res.message || "Last change reverted.", "success");
          this.load();
          state.checkUndo();
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    }

    // Bind Inline Cell Editing (Double-click)
    const editableCells = this.container.querySelectorAll(".editable-cell");
    editableCells.forEach((cell) => {
      cell.addEventListener("dblclick", () => {
        this.startCellEdit(cell);
      });
    });
  }

  startCellEdit(td) {
    if (this.editingCell && this.editingCell !== td) {
      this.cancelCellEdit(this.editingCell);
    }

    this.editingCell = td;
    td.classList.add("editing");

    const col = td.getAttribute("data-col");
    const rowIdx = parseInt(td.getAttribute("data-row"), 10);
    const rawVal = td.getAttribute("data-raw") || "";

    const originalHtml = td.innerHTML;

    td.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 4px; min-width: 140px;">
        <input type="text" class="cell-edit-input" value="${escapeHtml(rawVal)}" placeholder="(empty for null)" />
        <div style="display: flex; gap: 4px; justify-content: flex-end;">
          <button class="btn btn-primary btn-xs btn-cell-save" style="font-size: 10.5px; padding: 2px 7px;">Save</button>
          <button class="btn btn-outline btn-xs btn-cell-cancel" style="font-size: 10.5px; padding: 2px 7px;">Cancel</button>
        </div>
      </div>
    `;

    const input = td.querySelector(".cell-edit-input");
    const saveBtn = td.querySelector(".btn-cell-save");
    const cancelBtn = td.querySelector(".btn-cell-cancel");

    input.focus();
    input.select();

    const doSave = async () => {
      const newVal = input.value;
      try {
        const res = await api.editCell(this.datasetName, rowIdx, col, newVal);
        td.classList.remove("editing");
        td.setAttribute("data-raw", newVal);
        td.innerHTML = escapeHtml(newVal === "" ? null : newVal);
        this.editingCell = null;
        showToast(res.message || "Cell updated successfully.", "success");
        this.updateUndoStatus();
        state.checkUndo();
      } catch (err) {
        showToast(err.message, "error");
        input.focus();
      }
    };

    const doCancel = () => {
      td.classList.remove("editing");
      td.innerHTML = originalHtml;
      this.editingCell = null;
    };

    saveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      doSave();
    });

    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      doCancel();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        doSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        doCancel();
      }
    });
  }

  cancelCellEdit(td) {
    if (!td) return;
    const rawVal = td.getAttribute("data-raw");
    td.classList.remove("editing");
    td.innerHTML = escapeHtml(rawVal === "" ? null : rawVal);
    this.editingCell = null;
  }
}
