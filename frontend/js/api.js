/**
 * Auto_analysis API Client
 * Connects to the local FastAPI backend.
 */

const API_BASE = window.location.port === "8000"
  ? ""
  : `${window.location.protocol}//${window.location.hostname || "127.0.0.1"}:8000`;

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status} ${response.statusText}`;
      if (contentType.includes("application/json")) {
        const errorData = await response.json();
        errorMessage = errorData.detail || JSON.stringify(errorData);
      } else {
        const text = await response.text();
        if (text) errorMessage = text;
      }
      const err = new Error(errorMessage);
      err.status = response.status;
      throw err;
    }

    if (contentType.includes("application/json")) {
      return await response.json();
    }
    return response;
  } catch (err) {
    if (err.name === "TypeError" && err.message.toLowerCase().includes("fetch")) {
      const connErr = new Error(
        `Unable to reach local backend at ${API_BASE}. Please ensure the backend server is running on port 8000.`
      );
      connErr.status = 0;
      throw connErr;
    }
    throw err;
  }
}

export const api = {
  // System Health
  async getHealth() {
    return request("/api/health");
  },

  // Dataset Management
  async getDatasets() {
    return request("/api/datasets");
  },

  async getDatasetDetails(name) {
    return request(`/api/datasets/${encodeURIComponent(name)}`);
  },

  async getDatasetData(name, page = 1, pageSize = 25, search = "") {
    const params = new URLSearchParams({ page, page_size: pageSize });
    if (search) params.append("search", search);
    return request(`/api/datasets/${encodeURIComponent(name)}/data?${params}`);
  },

  async uploadCsv(file) {
    const formData = new FormData();
    formData.append("file", file);
    return request("/api/datasets/upload", {
      method: "POST",
      body: formData,
    });
  },

  async getAvailableSamples() {
    return request("/api/available-samples");
  },

  async loadSample(filename) {
    return request("/api/datasets/load-sample", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename }),
    });
  },

  async clearSession() {
    return request("/api/datasets/clear-session", {
      method: "POST",
    });
  },

  async getSavedFiles() {
    return request("/api/saved-files");
  },

  async deleteSavedFile(filename, folder = "exports") {
    return request("/api/saved-files/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, folder }),
    });
  },

  async resetDataset(name) {
    return request(`/api/datasets/${encodeURIComponent(name)}/reset`, {
      method: "POST",
    });
  },

  async deleteDataset(name) {
    return request(`/api/datasets/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
  },

  // Data Cleaning & Transformations
  async cleanFillMissing(payload) {
    return request("/api/clean/fill-missing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async cleanRemoveDuplicates(payload) {
    return request("/api/clean/remove-duplicates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async cleanRenameColumns(payload) {
    return request("/api/clean/rename-columns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async cleanConvertType(payload) {
    return request("/api/clean/convert-type", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async cleanDropColumns(payload) {
    return request("/api/clean/drop-columns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async cleanFilterRows(payload) {
    return request("/api/clean/filter-rows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async cleanSplitColumn(payload) {
    return request("/api/clean/split-column", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async cleanCombineColumns(payload) {
    return request("/api/clean/combine-columns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async cleanConvertDatetime(payload) {
    return request("/api/clean/convert-datetime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async cleanExtractDatetime(payload) {
    return request("/api/clean/extract-datetime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  async editCell(name, rowIndex, column, newValue) {
    return request(`/api/datasets/${encodeURIComponent(name)}/edit-cell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        row_index: rowIndex,
        column: column,
        new_value: newValue,
      }),
    });
  },

  async undoDataset(name) {
    return request(`/api/datasets/${encodeURIComponent(name)}/undo`, {
      method: "POST",
    });
  },

  async canUndoDataset(name) {
    return request(`/api/datasets/${encodeURIComponent(name)}/can-undo`);
  },

  async renameDataset(name, newName) {
    return request(`/api/datasets/${encodeURIComponent(name)}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_name: newName }),
    });
  },

  async cleanDetectDuplicates(payload) {
    return request("/api/clean/detect-duplicates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  // SQL Engine & Autocomplete
  async runSqlQuery(query, datasetNames = null) {
    return request("/api/sql-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, dataset_names: datasetNames }),
    });
  },

  async getSqlSuggestions(query, schemas = {}) {
    return request("/api/sql-helper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, schemas }),
    });
  },

  async getSqlReferenceCategories() {
    return request("/api/sql-reference/categories");
  },

  async getSqlReference(term = "", category = "") {
    const params = new URLSearchParams();
    if (term) params.append("term", term);
    if (category) params.append("category", category);
    const queryString = params.toString() ? `?${params.toString()}` : "";
    return request(`/api/sql-reference${queryString}`);
  },

  // Charts
  async getDatasetChart(datasetName, chartType, xColumn, yColumn = null) {
    return request(`/api/datasets/${encodeURIComponent(datasetName)}/chart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chart_type: chartType,
        x_column: xColumn,
        y_column: yColumn,
      }),
    });
  },

  // Relationships
  async evaluatePrimaryKeys(datasetName) {
    return request(`/api/relationships/${encodeURIComponent(datasetName)}/evaluate-pk`);
  },

  async checkPrimaryKey(datasetName, columns) {
    return request("/api/relationships/check-pk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataset_name: datasetName,
        columns,
      }),
    });
  },

  async checkForeignKey(parentDataset, parentCol, childDataset, childCol) {
    return request("/api/relationships/check-fk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent_dataset_name: parentDataset,
        parent_column: parentCol,
        child_dataset_name: childDataset,
        child_column: childCol,
      }),
    });
  },

  // Export URL
  getExportUrl(datasetName, filename = "", includeIndex = false) {
    const params = new URLSearchParams({
      dataset_name: datasetName,
      include_index: includeIndex ? "true" : "false",
    });
    if (filename) params.append("filename", filename);
    return `${API_BASE}/api/export-csv?${params.toString()}`;
  },
};
