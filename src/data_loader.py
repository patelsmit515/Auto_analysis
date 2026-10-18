"""Load and inspect CSV datasets."""

import io
import json
from pathlib import Path

import pandas as pd

from src.config import PREVIEW_ROWS, SUPPORTED_FILE_TYPE


def load_csv(file_source):
    """Load a CSV file from a path or file-like object with validation against HTML and non-CSV files."""

    # 1. Check path extension
    if isinstance(file_source, (str, Path)):
        path = Path(file_source)
        if path.suffix.lower() != SUPPORTED_FILE_TYPE:
            raise ValueError("Only CSV files (.csv) are supported. Please upload a valid CSV file.")

        with open(path, "rb") as f:
            sample_bytes = f.read(2048)
    elif hasattr(file_source, "read"):
        sample_bytes = file_source.read(2048)
        if hasattr(file_source, "seek"):
            file_source.seek(0)
    else:
        sample_bytes = b""

    # 2. Check for binary / null bytes
    if b"\x00" in sample_bytes:
        raise ValueError("The file contains binary data and cannot be parsed as a plain-text CSV dataset.")

    # 3. Check for HTML or XML markers
    sample_text = sample_bytes.decode("utf-8", errors="ignore").lower().strip()
    html_signatures = [
        "<!doctype html",
        "<html",
        "<head",
        "<body",
        "<?xml",
        "<meta",
        "<title",
        "<script",
    ]
    for sig in html_signatures:
        if sig in sample_text:
            raise ValueError(
                "The uploaded file appears to be an HTML webpage or markup document, not a valid CSV dataset. "
                "Please upload a plain-text comma-separated values (.csv) file."
            )

    try:
        df = pd.read_csv(file_source)
    except pd.errors.EmptyDataError as err:
        raise ValueError("The uploaded CSV file is completely empty.") from err
    except Exception as err:
        raise ValueError(f"Could not parse the file as a valid CSV: {err}") from err

    if len(df.columns) == 0:
        raise ValueError("The CSV file contains no columns.")

    return df


def inspect_data(df):
    """Return detailed information about a dataset."""

    row_count = len(df)
    column_count = len(df.columns)

    missing_by_column = {
        column: int(count)
        for column, count in df.isnull().sum().items()
    }

    missing_percentage_by_column = {
        column: round(
            (count / row_count) * 100, 2
        ) if row_count > 0 else 0.0
        for column, count in missing_by_column.items()
    }

    unique_values_by_column = {
        column: int(df[column].nunique(dropna=True))
        for column in df.columns
    }

    duplicate_rows = int(df.duplicated().sum())
    duplicate_percentage = (
        round((duplicate_rows / row_count) * 100, 2)
        if row_count > 0 else 0.0
    )

    total_missing = sum(missing_by_column.values())

    if total_missing == 0 and duplicate_rows == 0:
        quality_summary = "No missing values or duplicate rows detected."
    else:
        issues = []

        if total_missing > 0:
            issues.append(f"{total_missing} missing values")

        if duplicate_rows > 0:
            issues.append(f"{duplicate_rows} duplicate rows")

        quality_summary = "Found " + " and ".join(issues) + "."

    preview = json.loads(
        df.head(PREVIEW_ROWS).to_json(
            orient="records",
            date_format="iso"
        )
    )

    return {
        "rows": row_count,
        "columns": column_count,
        "missing_values": total_missing,
        "duplicate_rows": duplicate_rows,
        "duplicate_percentage": duplicate_percentage,
        "column_names": list(df.columns),
        "data_types": df.dtypes.astype(str).to_dict(),
        "missing_by_column": missing_by_column,
        "missing_percentage_by_column": missing_percentage_by_column,
        "unique_values_by_column": unique_values_by_column,
        "quality_summary": quality_summary,
        "preview": preview,
    }
