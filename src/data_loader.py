import json
from pathlib import Path

import pandas as pd

from src.config import PREVIEW_ROWS, SUPPORTED_FILE_TYPE


def load_csv(file_source):
    """Load a CSV file from a path or file-like object."""

    if isinstance(file_source, (str, Path)):
        if Path(file_source).suffix.lower() != SUPPORTED_FILE_TYPE:
            raise ValueError("Only CSV files are supported.")

    return pd.read_csv(file_source)


def inspect_data(df):
    """Return basic information about a dataset."""

    preview = json.loads(
        df.head(PREVIEW_ROWS).to_json(
            orient="records",
            date_format="iso"
        )
    )

    return {
        "rows": len(df),
        "columns": len(df.columns),
        "missing_values": int(df.isnull().sum().sum()),
        "duplicate_rows": int(df.duplicated().sum()),
        "column_names": list(df.columns),
        "data_types": df.dtypes.astype(str).to_dict(),
        "missing_by_column": {
            column: int(count)
            for column, count in df.isnull().sum().items()
        },
        "preview": preview,
    }
