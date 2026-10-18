"""FastAPI endpoints for Auto_analysis."""

import json
from io import BytesIO
from pathlib import Path
import re
import time
from typing import Any, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import pandas as pd

from src.config import PROJECT_NAME, PREVIEW_ROWS
from src.data_loader import load_csv, inspect_data
from src.validation import validate_data
from src.charts import prepare_chart, SUPPORTED_CHARTS
from src.cleaning import (
    fill_missing_values,
    remove_duplicates,
    detect_duplicates,
    edit_cell,
    rename_columns,
    convert_column_type,
    drop_columns,
    filter_rows,
    split_column,
    combine_columns,
    convert_datetime_column,
    extract_datetime_parts,
)
from src.sql_engine import run_query
from src.sql_helper import get_sql_reference, suggest_sql, SQL_CATEGORIES
from src.relationships import check_primary_key, check_foreign_key, evaluate_primary_keys
from src.export import export_csv


app = FastAPI(
    title=PROJECT_NAME,
    description="A local data cleaning and SQL analysis application.",
    version="1.0.0",
)

# Enable CORS for local-first desktop-style browser access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for session datasets, original uploaded versions, and undo history
DATASETS: dict[str, pd.DataFrame] = {}
ORIGINAL_DATASETS: dict[str, pd.DataFrame] = {}
DATASET_HISTORY: dict[str, list[pd.DataFrame]] = {}


def push_dataset_history(name: str):
    """Save a snapshot of the current dataset state for undo."""
    if name in DATASETS:
        if name not in DATASET_HISTORY:
            DATASET_HISTORY[name] = []
        DATASET_HISTORY[name].append(DATASETS[name].copy(deep=True))
        if len(DATASET_HISTORY[name]) > 20:
            DATASET_HISTORY[name].pop(0)


def sanitize_dataset_name(name: str) -> str:
    """Sanitize dataset filename into a safe SQL table identifier."""
    base = Path(name).stem
    sanitized = re.sub(r"[^\w]", "_", base)
    if not sanitized or sanitized[0].isdigit():
        sanitized = f"tbl_{sanitized}"
    return sanitized


def df_to_records(df: pd.DataFrame, limit: Optional[int] = None, offset: int = 0) -> list[dict]:
    """Convert a DataFrame slice to JSON-serializable records."""
    if limit is not None:
        sliced = df.iloc[offset : offset + limit]
    else:
        sliced = df
    return json.loads(sliced.to_json(orient="records", date_format="iso"))


def validate_sql_safety(query: str):
    """Ensure SQL query contains only safe analytical SELECT/WITH statements."""
    cleaned = re.sub(r"--.*?$|/\*.*?\*/", "", query, flags=re.MULTILINE).strip()
    if not cleaned:
        raise ValueError("Query cannot be empty.")

    statements = [s.strip() for s in cleaned.split(";") if s.strip()]
    if len(statements) > 1:
        raise ValueError("Executing multiple SQL statements is not permitted.")

    statement = statements[0]
    if not re.match(r"^(?:SELECT|WITH)\b", statement, re.IGNORECASE):
        raise ValueError("Only analytical SELECT or WITH queries are permitted.")

    forbidden = [
        r"\bATTACH\b",
        r"\bDETACH\b",
        r"\bCOPY\b",
        r"\bINSTALL\b",
        r"\bLOAD\b",
        r"\bPRAGMA\b",
        r"\bCALL\b",
        r"\bEXPORT\b",
        r"\bIMPORT\b",
        r"\bCREATE\b",
        r"\bDROP\b",
        r"\bALTER\b",
        r"\bINSERT\b",
        r"\bUPDATE\b",
        r"\bDELETE\b",
        r"\bread_csv\b",
        r"\bread_parquet\b",
        r"\bread_json\b",
        r"\bscan\b",
        r"\bhttpfs\b",
        r"\bread_blob\b",
        r"\bcheckpoint\b",
    ]
    for pattern in forbidden:
        if re.search(pattern, statement, re.IGNORECASE):
            raw_keyword = pattern.replace(r"\b", "")
            raise ValueError(f"Disallowed SQL keyword or function detected: '{raw_keyword}'.")


def apply_or_preview_transformation(
    dataset_name: str,
    transform_func,
    apply: bool = True,
    save_as: Optional[str] = None,
    action_description: str = "Transformed dataset",
):
    """Execute a cleaning transformation, generating before/after previews and updating dataset if applied."""
    if dataset_name not in DATASETS:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{dataset_name}' not found.",
        )

    current_df = DATASETS[dataset_name]
    before_preview = df_to_records(current_df, limit=10)

    try:
        new_df = transform_func(current_df)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    except Exception as err:
        raise HTTPException(
            status_code=400, detail=f"Transformation error: {err}"
        ) from err

    after_preview = df_to_records(new_df, limit=10)
    target_name = dataset_name

    if apply:
        if save_as and save_as.strip():
            target_name = sanitize_dataset_name(save_as)
            DATASETS[target_name] = new_df.copy()
            ORIGINAL_DATASETS[target_name] = new_df.copy()
            DATASET_HISTORY[target_name] = []
        else:
            push_dataset_history(dataset_name)
            DATASETS[dataset_name] = new_df.copy()

    return {
        "success": True,
        "message": action_description,
        "dataset_name": target_name,
        "applied": apply,
        "saved_as_new": bool(save_as and save_as.strip() and apply),
        "rows_before": len(current_df),
        "rows_after": len(new_df),
        "cols_before": len(current_df.columns),
        "cols_after": len(new_df.columns),
        "before_preview": before_preview,
        "after_preview": after_preview,
        "information": inspect_data(new_df),
        "validation": validate_data(new_df),
    }

# Note: Datasets are session-only and not auto-loaded on startup,
# ensuring the user starts with a clean workspace as requested.


# --- Pydantic Request Models ---

class SQLHelperRequest(BaseModel):
    """Input for SQL autocomplete suggestions."""
    query: str = ""
    schemas: dict[str, list[str]] = Field(default_factory=dict)


class SQLQueryRequest(BaseModel):
    """Input for SQL query execution."""
    query: str
    dataset_names: Optional[list[str]] = None


class PrimaryKeyCheckRequest(BaseModel):
    """Input for checking primary key validity."""
    dataset_name: str
    columns: list[str]


class ForeignKeyCheckRequest(BaseModel):
    """Input for checking foreign key validity."""
    parent_dataset_name: str
    parent_column: str
    child_dataset_name: str
    child_column: str


class FillMissingRequest(BaseModel):
    dataset_name: str
    columns: Optional[list[str]] = None
    strategy: str = "mean"
    fill_value: Optional[Any] = None
    apply: bool = True
    save_as: Optional[str] = None


class EditCellRequest(BaseModel):
    """Input for editing a single table cell."""
    row_index: int
    column: str
    new_value: Any = None


class RenameDatasetRequest(BaseModel):
    """Input for renaming a registered dataset."""
    new_name: str


class DetectDuplicatesRequest(BaseModel):
    """Input for previewing duplicate rows."""
    dataset_name: str
    subset: Optional[list[str]] = None
    keep: str = "first"


class RemoveDuplicatesRequest(BaseModel):
    dataset_name: str
    subset: Optional[list[str]] = None
    keep: str = "first"
    apply: bool = True
    save_as: Optional[str] = None


class RenameColumnsRequest(BaseModel):
    dataset_name: str
    column_mapping: dict[str, str]
    apply: bool = True
    save_as: Optional[str] = None


class ConvertTypeRequest(BaseModel):
    dataset_name: str
    column: str
    data_type: str
    apply: bool = True
    save_as: Optional[str] = None


class DropColumnsRequest(BaseModel):
    dataset_name: str
    columns: list[str]
    apply: bool = True
    save_as: Optional[str] = None


class FilterRowsRequest(BaseModel):
    dataset_name: str
    column: str
    operator: str
    value: Any
    apply: bool = True
    save_as: Optional[str] = None


class SplitColumnRequest(BaseModel):
    dataset_name: str
    column: str
    separator: Any
    new_columns: Optional[list[str]] = None
    regex: bool = False
    keep_original: bool = True
    max_splits: int = -1
    apply: bool = True
    save_as: Optional[str] = None


class CombineColumnsRequest(BaseModel):
    dataset_name: str
    columns: list[str]
    new_column: str
    separator: str = " "
    keep_original: bool = True
    apply: bool = True
    save_as: Optional[str] = None


class ConvertDatetimeRequest(BaseModel):
    dataset_name: str
    column: str
    date_format: Optional[str] = None
    errors: str = "coerce"
    new_column: Optional[str] = None
    apply: bool = True
    save_as: Optional[str] = None


class ExtractDatetimePartsRequest(BaseModel):
    dataset_name: str
    column: str
    parts: list[str]
    prefix: Optional[str] = None
    keep_original: bool = True
    date_format: Optional[str] = None
    apply: bool = True
    save_as: Optional[str] = None


class DatasetChartRequest(BaseModel):
    chart_type: str
    x_column: str
    y_column: Optional[str] = None


class LoadSampleRequest(BaseModel):
    filename: str


class DeleteFileRequest(BaseModel):
    filename: str
    folder: str = "exports"  # "exports" or "root"


# ==========================================
# 1. Preserved Standard Endpoints
# ==========================================

@app.get("/")
def home():
    return {
        "project": PROJECT_NAME,
        "status": "running",
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}


@app.post("/api/inspect-csv")
async def inspect_csv(file: UploadFile = File(...)):
    """Upload a CSV and return its inspection results."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a CSV file.",
        )

    try:
        contents = await file.read()
        df = load_csv(BytesIO(contents))

        # Register in session
        name = sanitize_dataset_name(file.filename)
        DATASETS[name] = df.copy()
        ORIGINAL_DATASETS[name] = df.copy()

        information = inspect_data(df)
        validation = validate_data(df)

        return {
            "filename": file.filename,
            "dataset_name": name,
            "information": information,
            "validation": validation,
        }

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read the CSV file: {error}",
        ) from error


@app.post("/api/create-chart")
async def create_chart(
    file: UploadFile = File(...),
    chart_type: str = Form(...),
    x_column: str = Form(...),
    y_column: str | None = Form(default=None),
):
    """Prepare chart data based on the user's selections."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a CSV file.",
        )

    try:
        contents = await file.read()
        df = load_csv(BytesIO(contents))

        chart = prepare_chart(
            df=df,
            chart_type=chart_type,
            x_column=x_column,
            y_column=y_column or None,
        )

        return {
            "filename": file.filename,
            "chart": chart,
        }

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Could not create chart: {error}",
        ) from error


@app.get("/api/sql-reference/categories")
def sql_reference_categories():
    """Return distinct categories available in SQL reference."""
    return {"categories": SQL_CATEGORIES}


@app.get("/api/sql-reference")
def sql_reference(term: str | None = None, category: str | None = None):
    """Return SQL syntax references, optionally filtered by a search term or category."""
    return {
        "references": get_sql_reference(term=term, category=category),
    }


@app.post("/api/sql-helper")
def sql_helper(request: SQLHelperRequest):
    """Return SQL autocomplete suggestions for the current query."""
    # If client didn't supply schemas, supply schemas from loaded session datasets
    schemas = request.schemas
    if not schemas:
        schemas = {name: list(df.columns) for name, df in DATASETS.items()}

    return suggest_sql(
        query=request.query,
        schemas=schemas,
    )


# ==========================================
# 2. Session Dataset Management
# ==========================================

@app.get("/api/datasets")
def list_datasets():
    """List all registered datasets in the current session."""
    datasets_list = []
    for name, df in DATASETS.items():
        orig_df = ORIGINAL_DATASETS.get(name)
        is_modified = False
        if orig_df is not None:
            is_modified = not df.equals(orig_df)

        datasets_list.append({
            "name": name,
            "rows": len(df),
            "columns": len(df.columns),
            "column_names": list(df.columns),
            "data_types": df.dtypes.astype(str).to_dict(),
            "is_modified": is_modified,
        })
    return {"datasets": datasets_list}


@app.post("/api/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)):
    """Upload and register a dataset in the active session."""
    return await inspect_csv(file)


@app.get("/api/datasets/{name}")
def get_dataset_details(name: str):
    """Get full inspection, validation, and preview for a dataset."""
    if name not in DATASETS:
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found.")

    df = DATASETS[name]
    return {
        "name": name,
        "information": inspect_data(df),
        "validation": validate_data(df),
    }


@app.get("/api/datasets/{name}/data")
def get_dataset_data(
    name: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=500),
    search: Optional[str] = Query(default=None),
):
    """Fetch paginated rows from a registered dataset."""
    if name not in DATASETS:
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found.")

    df = DATASETS[name]
    filtered_df = df

    if search and search.strip():
        term = search.strip().lower()
        mask = pd.Series(False, index=df.index)
        for col in df.columns:
            mask = mask | df[col].astype(str).str.lower().str.contains(term, regex=False, na=False)
        filtered_df = df[mask]

    total_rows = len(filtered_df)
    total_pages = max(1, (total_rows + page_size - 1) // page_size)
    offset = (page - 1) * page_size
    sliced = filtered_df.iloc[offset : offset + page_size].copy()
    indices = sliced.index.tolist()
    rows = df_to_records(sliced)
    for i, rec in enumerate(rows):
        rec["_row_index"] = int(indices[i])

    return {
        "dataset_name": name,
        "page": page,
        "page_size": page_size,
        "total_rows": total_rows,
        "total_pages": total_pages,
        "column_names": list(df.columns),
        "data_types": df.dtypes.astype(str).to_dict(),
        "rows": rows,
    }


@app.post("/api/datasets/{name}/edit-cell")
def api_edit_cell(name: str, request: EditCellRequest):
    """Edit a single cell in the dataset working copy."""
    if name not in DATASETS:
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found.")

    df = DATASETS[name]
    try:
        push_dataset_history(name)
        new_df = edit_cell(
            df=df,
            row_index=request.row_index,
            column=request.column,
            new_value=request.new_value,
        )
        DATASETS[name] = new_df
        return {
            "success": True,
            "message": f"Updated row {request.row_index}, column '{request.column}'.",
            "dataset_name": name,
            "row_index": request.row_index,
            "column": request.column,
            "new_value": str(new_df.iat[request.row_index, new_df.columns.get_loc(request.column)]),
            "information": inspect_data(new_df),
            "validation": validate_data(new_df),
            "can_undo": len(DATASET_HISTORY.get(name, [])) > 0,
        }
    except ValueError as err:
        if name in DATASET_HISTORY and DATASET_HISTORY[name]:
            DATASET_HISTORY[name].pop()
        raise HTTPException(status_code=400, detail=str(err)) from err


@app.post("/api/datasets/{name}/undo")
def api_undo_dataset(name: str):
    """Undo the last applied transformation or cell edit on the dataset."""
    if name not in DATASETS:
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found.")

    history = DATASET_HISTORY.get(name, [])
    if not history:
        raise HTTPException(
            status_code=400,
            detail=f"No previous changes to undo for dataset '{name}'.",
        )

    previous_df = history.pop()
    DATASETS[name] = previous_df

    return {
        "success": True,
        "message": f"Undid the last change on '{name}'.",
        "dataset_name": name,
        "rows": len(previous_df),
        "columns": len(previous_df.columns),
        "column_names": list(previous_df.columns),
        "data_types": previous_df.dtypes.astype(str).to_dict(),
        "can_undo": len(history) > 0,
        "information": inspect_data(previous_df),
        "validation": validate_data(previous_df),
    }


@app.get("/api/datasets/{name}/can-undo")
def api_can_undo(name: str):
    """Check if the dataset has changes in its undo history stack."""
    return {"can_undo": len(DATASET_HISTORY.get(name, [])) > 0}


@app.post("/api/datasets/{name}/rename")
def api_rename_dataset(name: str, request: RenameDatasetRequest):
    """Rename a dataset in the active session."""
    if name not in DATASETS:
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found.")

    new_name = sanitize_dataset_name(request.new_name)
    if not new_name:
        raise HTTPException(status_code=400, detail="Invalid new dataset name.")

    if new_name == name:
        return {"success": True, "old_name": name, "new_name": new_name}

    if new_name in DATASETS:
        raise HTTPException(
            status_code=400,
            detail=f"A dataset named '{new_name}' already exists in the session.",
        )

    DATASETS[new_name] = DATASETS.pop(name)
    if name in ORIGINAL_DATASETS:
        ORIGINAL_DATASETS[new_name] = ORIGINAL_DATASETS.pop(name)
    if name in DATASET_HISTORY:
        DATASET_HISTORY[new_name] = DATASET_HISTORY.pop(name)

    return {
        "success": True,
        "message": f"Dataset '{name}' renamed to '{new_name}'.",
        "old_name": name,
        "new_name": new_name,
    }


@app.post("/api/datasets/{name}/reset")
def reset_dataset(name: str):
    """Reset a modified dataset back to its original uploaded state."""
    if name not in DATASETS or name not in ORIGINAL_DATASETS:
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found.")

    push_dataset_history(name)
    DATASETS[name] = ORIGINAL_DATASETS[name].copy()
    df = DATASETS[name]
    return {
        "success": True,
        "message": f"Dataset '{name}' has been reset to its original version.",
        "dataset_name": name,
        "information": inspect_data(df),
        "validation": validate_data(df),
    }


@app.delete("/api/datasets/{name}")
def delete_dataset(name: str):
    """Remove a dataset from the active session."""
    if name not in DATASETS:
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found.")

    del DATASETS[name]
    if name in ORIGINAL_DATASETS:
        del ORIGINAL_DATASETS[name]
    if name in DATASET_HISTORY:
        del DATASET_HISTORY[name]

    return {"success": True, "message": f"Dataset '{name}' removed from session."}


@app.post("/api/datasets/clear-session")
def clear_session():
    """Remove all datasets from the active workspace."""
    count = len(DATASETS)
    DATASETS.clear()
    ORIGINAL_DATASETS.clear()
    DATASET_HISTORY.clear()
    return {"success": True, "message": f"Cleared {count} dataset(s) from session."}


@app.get("/api/saved-files")
def list_saved_files():
    """List CSV files saved in data/exports/ and root data/."""
    exports_dir = Path("data/exports").resolve()
    data_dir = Path("data").resolve()

    exports = []
    if exports_dir.exists():
        for f in exports_dir.glob("*.csv"):
            if not f.name.startswith("."):
                exports.append({
                    "filename": f.name,
                    "folder": "exports",
                    "size_bytes": f.stat().st_size,
                    "path": f"data/exports/{f.name}",
                })

    root_files = []
    if data_dir.exists():
        for f in data_dir.glob("*.csv"):
            if not f.name.startswith("."):
                root_files.append({
                    "filename": f.name,
                    "folder": "root",
                    "size_bytes": f.stat().st_size,
                    "path": f"data/{f.name}",
                })

    return {
        "exports": sorted(exports, key=lambda x: x["filename"]),
        "root_data": sorted(root_files, key=lambda x: x["filename"]),
    }


@app.post("/api/saved-files/delete")
def delete_saved_file(request: DeleteFileRequest):
    """Permanently delete a saved file from data/exports/ or data/ with path protection."""
    base_dir = Path("data/exports").resolve() if request.folder == "exports" else Path("data").resolve()
    target_path = (base_dir / request.filename).resolve()

    try:
        if not target_path.is_relative_to(base_dir):
            raise HTTPException(status_code=400, detail="Invalid path traversal attempt.")
    except Exception as err:
        raise HTTPException(status_code=400, detail="Invalid file path.") from err

    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(status_code=404, detail=f"File '{request.filename}' not found.")

    if target_path.suffix.lower() != ".csv":
        raise HTTPException(status_code=400, detail="Only .csv files may be deleted.")

    try:
        target_path.unlink()
        return {"success": True, "message": f"File '{request.filename}' permanently deleted."}
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {err}") from err


@app.get("/api/available-samples")
def list_available_samples():
    """List CSV files available in the root data/ folder."""
    data_dir = Path("data")
    if not data_dir.exists():
        return {"samples": []}
    samples = [f.name for f in data_dir.glob("*.csv") if not f.name.startswith(".")]
    return {"samples": sorted(samples)}


@app.post("/api/datasets/load-sample")
def load_sample_dataset(request: LoadSampleRequest):
    """Load an existing CSV file from data/ into the active session."""
    data_dir = Path("data").resolve()
    target_path = (data_dir / request.filename).resolve()

    try:
        if not target_path.is_relative_to(data_dir):
            raise HTTPException(status_code=400, detail="Invalid path.")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path.")

    if not target_path.exists() or not target_path.is_file() or target_path.suffix.lower() != ".csv":
        raise HTTPException(status_code=404, detail=f"Sample '{request.filename}' not found.")

    df = load_csv(str(target_path))
    name = sanitize_dataset_name(request.filename)
    DATASETS[name] = df.copy()
    ORIGINAL_DATASETS[name] = df.copy()

    return {
        "dataset_name": name,
        "filename": request.filename,
        "information": inspect_data(df),
        "validation": validate_data(df),
    }


# ==========================================
# 3. Data Cleaning & Transformations
# ==========================================

@app.post("/api/clean/fill-missing")
def api_fill_missing(request: FillMissingRequest):
    """Fill missing values in selected columns."""
    def transform(df):
        return fill_missing_values(
            df=df,
            columns=request.columns,
            strategy=request.strategy,
            fill_value=request.fill_value,
        )

    cols_desc = ", ".join(request.columns) if request.columns else "all columns"
    return apply_or_preview_transformation(
        dataset_name=request.dataset_name,
        transform_func=transform,
        apply=request.apply,
        save_as=request.save_as,
        action_description=f"Filled missing values in {cols_desc} using '{request.strategy}'.",
    )


@app.post("/api/clean/detect-duplicates")
def api_detect_duplicates(request: DetectDuplicatesRequest):
    """Preview duplicate rows based on all or selected columns."""
    if request.dataset_name not in DATASETS:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{request.dataset_name}' not found.",
        )
    df = DATASETS[request.dataset_name]
    try:
        return detect_duplicates(
            df=df,
            subset=request.subset,
            keep=request.keep,
        )
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err


@app.post("/api/clean/remove-duplicates")
def api_remove_duplicates(request: RemoveDuplicatesRequest):
    """Remove duplicate rows from dataset based on all or selected columns."""
    def transform(df):
        return remove_duplicates(
            df=df,
            subset=request.subset,
            keep=request.keep,
        )

    cols_desc = ", ".join(request.subset) if request.subset else "all columns"
    return apply_or_preview_transformation(
        dataset_name=request.dataset_name,
        transform_func=transform,
        apply=request.apply,
        save_as=request.save_as,
        action_description=f"Removed duplicate rows based on {cols_desc} (retaining {request.keep} occurrence).",
    )


@app.post("/api/clean/rename-columns")
def api_rename_columns(request: RenameColumnsRequest):
    """Rename columns using mapping dictionary."""
    def transform(df):
        return rename_columns(df=df, column_mapping=request.column_mapping)

    mapping_desc = ", ".join(f"'{k}' -> '{v}'" for k, v in request.column_mapping.items())
    return apply_or_preview_transformation(
        dataset_name=request.dataset_name,
        transform_func=transform,
        apply=request.apply,
        save_as=request.save_as,
        action_description=f"Renamed columns: {mapping_desc}.",
    )


@app.post("/api/clean/convert-type")
def api_convert_type(request: ConvertTypeRequest):
    """Convert column to integer, float, string, or datetime."""
    def transform(df):
        return convert_column_type(
            df=df,
            column=request.column,
            data_type=request.data_type,
        )

    return apply_or_preview_transformation(
        dataset_name=request.dataset_name,
        transform_func=transform,
        apply=request.apply,
        save_as=request.save_as,
        action_description=f"Converted column '{request.column}' to {request.data_type}.",
    )


@app.post("/api/clean/drop-columns")
def api_drop_columns(request: DropColumnsRequest):
    """Drop selected columns from dataset."""
    def transform(df):
        return drop_columns(df=df, columns=request.columns)

    cols_desc = ", ".join(request.columns)
    return apply_or_preview_transformation(
        dataset_name=request.dataset_name,
        transform_func=transform,
        apply=request.apply,
        save_as=request.save_as,
        action_description=f"Dropped columns: {cols_desc}.",
    )


@app.post("/api/clean/filter-rows")
def api_filter_rows(request: FilterRowsRequest):
    """Filter rows using comparison operators."""
    def transform(df):
        col = request.column
        val = request.value

        # Attempt sensible numeric conversion if column is numeric
        if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
            try:
                if "." in str(val):
                    val = float(val)
                else:
                    val = int(val)
            except (ValueError, TypeError):
                pass

        return filter_rows(
            df=df,
            column=col,
            operator=request.operator,
            value=val,
        )

    return apply_or_preview_transformation(
        dataset_name=request.dataset_name,
        transform_func=transform,
        apply=request.apply,
        save_as=request.save_as,
        action_description=f"Filtered rows where '{request.column}' {request.operator} '{request.value}'.",
    )


@app.post("/api/clean/split-column")
def api_split_column(request: SplitColumnRequest):
    """Split text column into multiple columns using separator or regex."""
    def transform(df):
        sep = request.separator
        if isinstance(sep, str) and not request.regex and ("," in sep or ";" in sep):
            delims = [s.strip() for s in re.split(r"[\s,]+", sep) if s.strip()]
            if len(delims) > 1:
                sep = delims

        return split_column(
            df=df,
            column=request.column,
            separator=sep,
            new_columns=request.new_columns,
            regex=request.regex,
            keep_original=request.keep_original,
            max_splits=request.max_splits,
        )

    return apply_or_preview_transformation(
        dataset_name=request.dataset_name,
        transform_func=transform,
        apply=request.apply,
        save_as=request.save_as,
        action_description=f"Split column '{request.column}' by '{request.separator}'.",
    )


@app.post("/api/clean/combine-columns")
def api_combine_columns(request: CombineColumnsRequest):
    """Combine multiple columns into one with separator."""
    def transform(df):
        return combine_columns(
            df=df,
            columns=request.columns,
            new_column=request.new_column,
            separator=request.separator,
            keep_original=request.keep_original,
        )

    cols_desc = " + ".join(request.columns)
    return apply_or_preview_transformation(
        dataset_name=request.dataset_name,
        transform_func=transform,
        apply=request.apply,
        save_as=request.save_as,
        action_description=f"Combined columns ({cols_desc}) into '{request.new_column}'.",
    )


@app.post("/api/clean/convert-datetime")
def api_convert_datetime(request: ConvertDatetimeRequest):
    """Convert column to datetime with optional format, error handling, and conversion statistics."""
    if request.dataset_name not in DATASETS:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{request.dataset_name}' not found.",
        )
    current_df = DATASETS[request.dataset_name]
    if request.column not in current_df.columns:
        raise HTTPException(status_code=400, detail=f"Column '{request.column}' does not exist.")

    def transform(df):
        return convert_datetime_column(
            df=df,
            column=request.column,
            date_format=request.date_format or None,
            errors=request.errors,
            new_column=request.new_column or None,
        )

    target_col = request.new_column or request.column
    res = apply_or_preview_transformation(
        dataset_name=request.dataset_name,
        transform_func=transform,
        apply=request.apply,
        save_as=request.save_as,
        action_description=f"Converted '{request.column}' to datetime in '{target_col}'.",
    )

    try:
        temp_df = transform(current_df)
        converted_series = temp_df[target_col]
        orig_series = current_df[request.column]
        total_rows = len(current_df)
        orig_non_empty = int(orig_series.dropna().astype(str).str.strip().ne("").sum())
        successfully_converted = int(converted_series.notna().sum())
        invalid_values = int(max(0, orig_non_empty - successfully_converted))
        originally_missing = int(total_rows - orig_non_empty)

        res["stats"] = {
            "total_rows": total_rows,
            "successfully_converted": successfully_converted,
            "invalid_values": invalid_values,
            "missing_values": originally_missing,
        }
        res["message"] = (
            f"Converted '{request.column}' to datetime ({successfully_converted} valid timestamp(s), "
            f"{invalid_values} invalid value(s) converted to missing, {originally_missing} blank(s))."
        )
    except Exception:
        pass

    return res


@app.post("/api/clean/extract-datetime")
def api_extract_datetime(request: ExtractDatetimePartsRequest):
    """Extract datetime parts into individual columns."""
    def transform(df):
        return extract_datetime_parts(
            df=df,
            column=request.column,
            parts=request.parts,
            prefix=request.prefix or None,
            keep_original=request.keep_original,
            date_format=request.date_format or None,
        )

    parts_desc = ", ".join(request.parts)
    return apply_or_preview_transformation(
        dataset_name=request.dataset_name,
        transform_func=transform,
        apply=request.apply,
        save_as=request.save_as,
        action_description=f"Extracted components ({parts_desc}) from '{request.column}'.",
    )


# ==========================================
# 4. SQL Execution Engine
# ==========================================

@app.post("/api/sql-query")
def execute_sql_query(request: SQLQueryRequest):
    """Execute analytical SQL query using DuckDB against active datasets."""
    query = request.query.strip()
    try:
        validate_sql_safety(query)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err

    # Pick datasets to register
    datasets_to_register = {}
    if request.dataset_names:
        for name in request.dataset_names:
            if name in DATASETS:
                datasets_to_register[name] = DATASETS[name]
    else:
        datasets_to_register = DATASETS

    if not datasets_to_register:
        raise HTTPException(
            status_code=400,
            detail="No datasets available in the session to query.",
        )

    start_time = time.perf_counter()
    try:
        result_df = run_query(query=query, datasets=datasets_to_register)
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # Handle NaNs and dates cleanly
        rows = df_to_records(result_df)

        return {
            "query": query,
            "row_count": len(result_df),
            "column_count": len(result_df.columns),
            "columns": list(result_df.columns),
            "data_types": result_df.dtypes.astype(str).to_dict(),
            "rows": rows,
            "execution_time_ms": elapsed_ms,
        }

    except Exception as err:
        raise HTTPException(
            status_code=400,
            detail=f"SQL Execution Error: {err}",
        ) from err


# ==========================================
# 5. Dataset-based Chart Generation
# ==========================================

@app.post("/api/datasets/{dataset_name}/chart")
def create_dataset_chart(dataset_name: str, request: DatasetChartRequest):
    """Generate chart data for a registered dataset without re-uploading."""
    if dataset_name not in DATASETS:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{dataset_name}' not found.",
        )

    try:
        chart = prepare_chart(
            df=DATASETS[dataset_name],
            chart_type=request.chart_type,
            x_column=request.x_column,
            y_column=request.y_column or None,
        )
        return {
            "filename": dataset_name,
            "chart": chart,
        }
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Could not create chart: {error}",
        ) from error


# ==========================================
# 6. Relationships (Primary & Foreign Keys)
# ==========================================

@app.post("/api/relationships/check-pk")
def api_check_primary_key(request: PrimaryKeyCheckRequest):
    """Validate primary key uniqueness and missing values on dataset."""
    if request.dataset_name not in DATASETS:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{request.dataset_name}' not found.",
        )

    try:
        return check_primary_key(
            df=DATASETS[request.dataset_name],
            columns=request.columns,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/api/relationships/{name}/evaluate-pk")
def api_evaluate_primary_keys(name: str):
    """Automatically evaluate columns and candidate combinations for primary key eligibility."""
    if name not in DATASETS:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{name}' not found.",
        )

    try:
        return evaluate_primary_keys(DATASETS[name])
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err)) from err


@app.post("/api/relationships/check-fk")
def api_check_foreign_key(request: ForeignKeyCheckRequest):
    """Validate foreign key references from child to parent dataset."""
    if request.parent_dataset_name not in DATASETS:
        raise HTTPException(
            status_code=404,
            detail=f"Parent dataset '{request.parent_dataset_name}' not found.",
        )
    if request.child_dataset_name not in DATASETS:
        raise HTTPException(
            status_code=404,
            detail=f"Child dataset '{request.child_dataset_name}' not found.",
        )

    try:
        return check_foreign_key(
            parent_df=DATASETS[request.parent_dataset_name],
            parent_column=request.parent_column,
            child_df=DATASETS[request.child_dataset_name],
            child_column=request.child_column,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


# ==========================================
# 7. CSV Export
# ==========================================

@app.get("/api/export-csv")
def api_export_csv(
    dataset_name: str = Query(...),
    filename: Optional[str] = Query(default=None),
    include_index: bool = Query(default=False),
):
    """Export the active cleaned dataset as a downloadable CSV."""
    if dataset_name not in DATASETS:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{dataset_name}' not found.",
        )

    df = DATASETS[dataset_name]
    out_name = filename.strip() if filename and filename.strip() else f"cleaned_{dataset_name}.csv"
    if not out_name.lower().endswith(".csv"):
        out_name += ".csv"

    # Reuse src.export.export_csv to also persist locally in data/exports/
    try:
        export_dir = Path("data") / "exports"
        export_dir.mkdir(parents=True, exist_ok=True)
        local_export_path = export_dir / out_name
        export_csv(df, str(local_export_path))
    except Exception:
        pass

    csv_data = df.to_csv(index=include_index)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{out_name}"',
            "Cache-Control": "no-cache",
        },
    )


# ==========================================
# 8. Mount Frontend Static Files
# ==========================================

frontend_dir = Path("frontend")
if frontend_dir.exists():
    app.mount("/app", StaticFiles(directory="frontend", html=True), name="frontend")
