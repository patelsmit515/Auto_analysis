/**
 * Auto_analysis Main Application Controller
 */

import { state } from "./state.js";
import { api } from "./api.js";
import { showToast } from "./components/toasts.js";
import { initDashboardView } from "./views/dashboard.js";
import { initImportView } from "./views/import.js";
import { initCleaningView } from "./views/cleaning.js";
import { initSqlView } from "./views/sql.js";
import { initChartsView } from "./views/charts.js";
import { initRelationshipsView } from "./views/relationships.js";
import { initExportView } from "./views/export.js";

const VIEW_METADATA = {
  dashboard: {
    title: "Dataset Dashboard",
    subtitle: "Overview of loaded data dimensions, statistics, and quality score",
  },
  import: {
    title: "Import & Inspect Data",
    subtitle: "Upload CSV files, examine records, and verify data quality",
  },
  clean: {
    title: "Clean & Transform",
    subtitle: "Transform missing values, duplicates, datatypes, text, and dates",
  },
  sql: {
    title: "SQL Analysis",
    subtitle: "Query datasets with DuckDB engine, autocomplete, and syntax assistance",
  },
  charts: {
    title: "Visual Charts",
    subtitle: "Render bar, line, scatter, histogram, pie, and box plot visualizations",
  },
  relationships: {
    title: "Dataset Relationships",
    subtitle: "Validate primary keys and verify foreign key referential integrity",
  },
  export: {
    title: "Export Cleaned Data",
    subtitle: "Download transformed datasets as CSV files locally",
  },
};

document.addEventListener("DOMContentLoaded", async () => {
  // Initialize View Containers
  initDashboardView(document.getElementById("view-dashboard"));
  initImportView(document.getElementById("view-import"));
  initCleaningView(document.getElementById("view-clean"));
  initSqlView(document.getElementById("view-sql"));
  initChartsView(document.getElementById("view-charts"));
  initRelationshipsView(document.getElementById("view-relationships"));
  initExportView(document.getElementById("view-export"));

  // Top header elements
  const pageTitle = document.getElementById("page-title");
  const pageSubtitle = document.getElementById("page-subtitle");
  const topDatasetSelect = document.getElementById("top-dataset-select");
  const navItems = document.querySelectorAll(".nav-item[data-tab]");
  const viewPanels = document.querySelectorAll(".view-panel");

  // Navigation switching function
  function switchTab(tabId) {
    if (!VIEW_METADATA[tabId]) return;

    // Update Nav item classes
    navItems.forEach((item) => {
      item.classList.toggle("active", item.getAttribute("data-tab") === tabId);
    });

    // Update Views
    viewPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.id === `view-${tabId}`);
    });

    // Update Header Text
    const meta = VIEW_METADATA[tabId];
    pageTitle.textContent = meta.title;
    pageSubtitle.textContent = meta.subtitle;

    state.activeTab = tabId;
  }

  // Bind nav click events
  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const tabId = item.getAttribute("data-tab");
      switchTab(tabId);
    });
  });

  // State tab-changed listener
  state.on("tab-changed", (tabId) => {
    switchTab(tabId);
  });

  // Populate top dataset picker dropdown on updates
  function updateDatasetPicker() {
    const datasets = state.datasets;
    const active = state.activeDataset;

    if (!topDatasetSelect) return;

    if (datasets.length === 0) {
      topDatasetSelect.innerHTML = `<option value="">No Datasets Loaded</option>`;
      topDatasetSelect.disabled = true;
      return;
    }

    topDatasetSelect.disabled = false;
    topDatasetSelect.innerHTML = datasets.map((d) => `
      <option value="${escapeHtml(d.name)}" ${d.name === active ? "selected" : ""}>
        ${escapeHtml(d.name)} (${d.rows}r)
      </option>
    `).join("");
  }

  topDatasetSelect.addEventListener("change", (e) => {
    const name = e.target.value;
    if (name) {
      state.setActiveDataset(name);
    }
  });

  state.on("datasets-updated", updateDatasetPicker);
  state.on("dataset-changed", (data) => {
    if (topDatasetSelect && data && data.name) {
      topDatasetSelect.value = data.name;
    }
  });

  // Check Backend Health
  try {
    const health = await api.getHealth();
    if (health.status === "healthy") {
      const dot = document.getElementById("backend-status-dot");
      const text = document.getElementById("backend-status-text");
      if (dot) dot.style.backgroundColor = "var(--success)";
      if (text) text.textContent = "Backend Connected";
    }
  } catch (err) {
    const dot = document.getElementById("backend-status-dot");
    const text = document.getElementById("backend-status-text");
    if (dot) dot.style.backgroundColor = "var(--danger)";
    if (text) text.textContent = "Backend Offline";
    showToast("Backend service is offline. Please start uvicorn on port 8000.", "error", 6000);
  }

  // Theme Toggle Persistence
  const savedTheme = localStorage.getItem("auto_analysis_theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeButton(savedTheme);

  const themeToggleBtn = document.getElementById("theme-toggle");
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const nextTheme = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", nextTheme);
      localStorage.setItem("auto_analysis_theme", nextTheme);
      updateThemeButton(nextTheme);
    });
  }

  function updateThemeButton(theme) {
    const icon = document.getElementById("theme-toggle-icon");
    const text = document.getElementById("theme-toggle-text");
    if (icon && text) {
      if (theme === "dark") {
        icon.textContent = "☀️";
        text.textContent = "Light";
      } else {
        icon.textContent = "🌙";
        text.textContent = "Dark";
      }
    }
  }

  // Global Undo button in top bar
  const topUndoBtn = document.getElementById("btn-top-undo");
  state.on("undo-status", (canUndo) => {
    if (topUndoBtn) {
      topUndoBtn.style.display = canUndo ? "inline-flex" : "none";
    }
  });

  if (topUndoBtn) {
    topUndoBtn.addEventListener("click", async () => {
      if (!state.activeDataset) return;
      try {
        const res = await api.undoDataset(state.activeDataset);
        showToast(res.message || "Last change reverted.", "success");
        await state.refreshDatasets(state.activeDataset);
        state.checkUndo();
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  state.on("dataset-changed", () => {
    state.checkUndo();
  });

  // Load initial datasets from backend
  await state.refreshDatasets();

  // Initial tab set
  switchTab("dashboard");
});

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
