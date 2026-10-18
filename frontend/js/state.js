/**
 * Auto_analysis Application State
 * Centralized reactive store for managing datasets, active selection, and UI views.
 */

import { api } from "./api.js";

class AppState {
  constructor() {
    this.activeDataset = null;
    this.datasets = [];
    this.activeDatasetDetails = null;
    this.activeTab = "dashboard";
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event).delete(callback);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        try {
          callback(data);
        } catch (err) {
          console.error(`Error in state listener for '${event}':`, err);
        }
      }
    }
  }

  async refreshDatasets(preferredActive = null) {
    try {
      const result = await api.getDatasets();
      this.datasets = result.datasets || [];

      if (this.datasets.length > 0) {
        if (preferredActive && this.datasets.some((d) => d.name === preferredActive)) {
          this.activeDataset = preferredActive;
        } else if (!this.activeDataset || !this.datasets.some((d) => d.name === this.activeDataset)) {
          this.activeDataset = this.datasets[0].name;
        }
        await this.loadActiveDatasetDetails();
      } else {
        this.activeDataset = null;
        this.activeDatasetDetails = null;
      }

      this.emit("datasets-updated", this.datasets);
      this.emit("dataset-changed", {
        name: this.activeDataset,
        details: this.activeDatasetDetails,
      });
    } catch (err) {
      console.error("Failed to refresh datasets:", err);
      this.emit("error", err);
    }
  }

  async setActiveDataset(name) {
    if (this.activeDataset === name && this.activeDatasetDetails) return;
    this.activeDataset = name;
    await this.loadActiveDatasetDetails();
    this.emit("dataset-changed", {
      name: this.activeDataset,
      details: this.activeDatasetDetails,
    });
  }

  async loadActiveDatasetDetails() {
    if (!this.activeDataset) {
      this.activeDatasetDetails = null;
      return;
    }
    try {
      this.activeDatasetDetails = await api.getDatasetDetails(this.activeDataset);
    } catch (err) {
      console.error(`Failed to load details for ${this.activeDataset}:`, err);
      this.activeDatasetDetails = null;
    }
  }

  getActiveDatasetObject() {
    return this.datasets.find((d) => d.name === this.activeDataset) || null;
  }

  getSchemaMap() {
    const schemas = {};
    for (const d of this.datasets) {
      schemas[d.name] = d.column_names || [];
    }
    return schemas;
  }

  setTab(tabId) {
    if (this.activeTab === tabId) return;
    this.activeTab = tabId;
    this.emit("tab-changed", tabId);
  }

  async checkUndo() {
    if (!this.activeDataset) {
      this.emit("undo-status", false);
      return false;
    }
    try {
      const res = await api.canUndoDataset(this.activeDataset);
      const canUndo = Boolean(res && res.can_undo);
      this.emit("undo-status", canUndo);
      return canUndo;
    } catch {
      this.emit("undo-status", false);
      return false;
    }
  }
}

export const state = new AppState();
