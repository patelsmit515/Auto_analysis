"""Clean and transform datasets using Pandas."""

import json
import re
import pandas as pd


def fill_missing_values(
    df, columns=None, strategy="mean", fill_value=None
):
    """Fill missing values in selected columns."""

    cleaned_df = df.copy()

    if columns is None:
        columns = cleaned_df.columns.tolist()

    for column in columns:
        if column not in cleaned_df.columns:
            raise ValueError(f"Column '{column}' does not exist.")

        if strategy == "mean":
            if not pd.api.types.is_numeric_dtype(cleaned_df[column]):
                raise ValueError(f"Mean requires a numeric column: {column}")
            value = cleaned_df[column].mean()

        elif strategy == "median":
            if not pd.api.types.is_numeric_dtype(cleaned_df[column]):
                raise ValueError(
                    f"Median requires a numeric column: {column}"
                )
            value = cleaned_df[column].median()

        elif strategy == "mode":
            modes = cleaned_df[column].mode()
            if modes.empty:
                continue
            value = modes.iloc[0]

        elif strategy == "constant":
            value = fill_value

        else:
            raise ValueError(
                "Choose mean, median, mode, or constant."
            )

        cleaned_df[column] = cleaned_df[column].fillna(value)

    return cleaned_df


def detect_duplicates(df, subset=None, keep="first"):
    """Detect duplicate rows based on all or selected columns."""

    if subset is not None:
        missing = [c for c in subset if c not in df.columns]
        if missing:
            raise ValueError(f"Columns not found: {missing}")

    keep_param = False if keep == "none" else keep
    mask = df.duplicated(subset=subset, keep=keep_param)

    # All duplicates including original instance for inspection
    all_mask = df.duplicated(subset=subset, keep=False)
    dup_df = df[all_mask].copy()
    dup_df["_row_index"] = dup_df.index

    return {
        "duplicate_count": int(mask.sum()),
        "total_rows": len(df),
        "columns": subset if subset is not None else list(df.columns),
        "keep": keep,
        "duplicate_rows": json.loads(dup_df.to_json(orient="records", date_format="iso")),
    }


def remove_duplicates(df, subset=None, keep="first"):
    """Remove duplicate rows based on all or selected columns."""

    if subset is not None:
        missing = [c for c in subset if c not in df.columns]
        if missing:
            raise ValueError(f"Columns not found: {missing}")

    keep_param = False if keep == "none" else keep
    return df.drop_duplicates(subset=subset, keep=keep_param).reset_index(drop=True)


def edit_cell(df, row_index, column, new_value):
    """Edit a single cell value in a DataFrame with type validation."""

    if column not in df.columns:
        raise ValueError(f"Column '{column}' does not exist.")

    if row_index < 0 or row_index >= len(df):
        raise ValueError(f"Row index {row_index} is out of bounds (0 to {len(df) - 1}).")

    result = df.copy()
    col_type = result[column].dtype

    if new_value is None or (isinstance(new_value, str) and new_value.strip() == ""):
        parsed_value = pd.NA if str(col_type).startswith("Int") or str(col_type).startswith("string") else None
    elif pd.api.types.is_numeric_dtype(result[column]):
        try:
            if "." in str(new_value):
                parsed_value = float(new_value)
            else:
                parsed_value = int(new_value)
        except (ValueError, TypeError) as err:
            raise ValueError(f"Cannot convert value '{new_value}' to numeric for column '{column}': {err}")
    elif pd.api.types.is_datetime64_any_dtype(result[column]):
        try:
            parsed_value = pd.to_datetime(new_value)
        except Exception as err:
            raise ValueError(f"Cannot convert value '{new_value}' to datetime for column '{column}': {err}")
    else:
        parsed_value = str(new_value)

    result.iat[row_index, result.columns.get_loc(column)] = parsed_value
    return result


def rename_columns(df, column_mapping):
    """Rename columns using a dictionary."""

    missing_columns = [
        column for column in column_mapping
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(f"Columns not found: {missing_columns}")

    return df.rename(columns=column_mapping)


def convert_column_type(df, column, data_type):
    """Convert a column to a selected data type."""

    if column not in df.columns:
        raise ValueError(f"Column '{column}' does not exist.")

    cleaned_df = df.copy()

    if data_type == "integer":
        cleaned_df[column] = pd.to_numeric(
            cleaned_df[column], errors="raise"
        ).astype("Int64")

    elif data_type == "float":
        cleaned_df[column] = pd.to_numeric(
            cleaned_df[column], errors="raise"
        ).astype(float)

    elif data_type == "string":
        cleaned_df[column] = cleaned_df[column].astype("string")

    elif data_type == "datetime":
        cleaned_df = convert_datetime_column(
            cleaned_df,
            column=column,
            date_format=None,
            errors="coerce",
        )

    else:
        raise ValueError(
            "Choose integer, float, string, or datetime."
        )

    return cleaned_df


def drop_columns(df, columns):
    """Remove selected columns."""

    missing_columns = [
        column for column in columns
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(f"Columns not found: {missing_columns}")

    return df.drop(columns=columns)


def filter_rows(df, column, operator, value):
    """Filter rows using a comparison."""

    if column not in df.columns:
        raise ValueError(f"Column '{column}' does not exist.")

    if operator == "==":
        result = df[df[column] == value]
    elif operator == "!=":
        result = df[df[column] != value]
    elif operator == ">":
        result = df[df[column] > value]
    elif operator == "<":
        result = df[df[column] < value]
    elif operator == ">=":
        result = df[df[column] >= value]
    elif operator == "<=":
        result = df[df[column] <= value]
    else:
        raise ValueError("Unsupported comparison operator.")

    return result.copy()


def split_column(
    df,
    column,
    separator,
    new_columns=None,
    regex=False,
    keep_original=True,
    max_splits=-1,
):
    """Split a column into multiple columns using a separator, list of separators, or regex."""

    if column not in df.columns:
        raise ValueError(f"Column '{column}' does not exist.")

    if isinstance(separator, (list, tuple)):
        if not separator:
            raise ValueError("The separator list cannot be empty.")
        separator = "|".join(re.escape(s) for s in separator)
        regex = True
    elif not isinstance(separator, str) or not separator:
        raise ValueError("The separator or regex pattern cannot be empty.")

    if max_splits < -1:
        raise ValueError("max_splits must be -1 or a non-negative integer.")

    split_data = df[column].astype("string").str.split(
        pat=separator,
        n=max_splits,
        expand=True,
        regex=regex,
    )

    if split_data.shape[1] < 2:
        raise ValueError(
            f"The separator did not split column '{column}'."
        )

    if new_columns is None:
        new_columns = [
            f"{column}_part_{i + 1}"
            for i in range(split_data.shape[1])
        ]

    if len(new_columns) != split_data.shape[1]:
        raise ValueError(
            f"Expected {split_data.shape[1]} new column names."
        )

    if len(set(new_columns)) != len(new_columns):
        raise ValueError("New column names must be unique.")

    if column in new_columns:
        raise ValueError(
            "New column names cannot include the original column name."
        )

    conflicts = [
        name for name in new_columns
        if name in df.columns
    ]

    if conflicts:
        raise ValueError(
            f"These output columns already exist: {conflicts}"
        )

    result = df.copy()

    for position, name in enumerate(new_columns):
        result[name] = split_data.iloc[:, position]

    if not keep_original:
        result = result.drop(columns=[column])

    return result


def combine_columns(
    df,
    columns,
    new_column,
    separator=" ",
    keep_original=True,
):
    """Combine selected columns into one column."""

    if not columns:
        raise ValueError("Select at least one column to combine.")

    if len(set(columns)) != len(columns):
        raise ValueError("Selected columns must be unique.")

    missing_columns = [
        column for column in columns
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(f"Columns not found: {missing_columns}")

    if new_column in df.columns:
        raise ValueError(
            f"Output column '{new_column}' already exists."
        )

    if not isinstance(separator, str):
        raise ValueError("The separator must be a string.")

    result = df.copy()

    selected = result[columns].astype("string").fillna("")

    result[new_column] = selected.apply(
        lambda row: separator.join(
            value.strip()
            for value in row
            if value.strip()
        ),
        axis=1,
    )

    if not keep_original:
        result = result.drop(columns=columns)

    return result


def convert_datetime_column(
    df,
    column,
    date_format=None,
    errors="coerce",
    new_column=None,
):
    """Convert a column to datetime, optionally creating a new column.

    - Automatically infers common ISO/standard formats when date_format is None/empty.
    - If errors='coerce', invalid values become missing values (NaT).
    - If errors='raise', conversion is rejected with a descriptive explanation.
    """

    if column not in df.columns:
        raise ValueError(f"Column '{column}' does not exist.")

    if errors not in ["coerce", "raise"]:
        raise ValueError("errors must be 'coerce' or 'raise'.")

    target_column = new_column if new_column is not None else column

    if target_column != column and target_column in df.columns:
        raise ValueError(
            f"Output column '{target_column}' already exists."
        )

    result = df.copy()
    raw = result[column]

    fmt = date_format.strip() if (isinstance(date_format, str) and date_format.strip()) else None

    if errors == "raise":
        try:
            if fmt:
                result[target_column] = pd.to_datetime(
                    raw,
                    format=fmt,
                    errors="raise",
                )
            else:
                result[target_column] = pd.to_datetime(
                    raw,
                    format="mixed",
                    errors="raise",
                )
        except Exception as err:
            # Diagnose which values failed
            test_res = pd.to_datetime(raw, format=fmt if fmt else "mixed", errors="coerce")
            non_empty = raw.notna() & (raw.astype(str).str.strip().ne(""))
            failed_mask = non_empty & test_res.isna()
            failed_samples = raw.loc[failed_mask].unique().tolist()[:5]
            samples_str = ", ".join(f'"{s}"' for s in failed_samples)
            count = int(failed_mask.sum())
            raise ValueError(
                f"Conversion rejected: column '{column}' contains {count} invalid date value(s) "
                f"such as [{samples_str}]. Choose 'Convert invalid values to missing values' (Coerce) "
                f"to convert them to nulls safely, or provide a matching format."
            ) from err
    else:  # errors == "coerce"
        if fmt:
            try:
                result[target_column] = pd.to_datetime(
                    raw,
                    format=fmt,
                    errors="coerce",
                )
            except Exception:
                result[target_column] = pd.to_datetime(
                    raw,
                    format="mixed",
                    errors="coerce",
                )
        else:
            result[target_column] = pd.to_datetime(
                raw,
                format="mixed",
                errors="coerce",
            )

    return result


def extract_datetime_parts(
    df,
    column,
    parts,
    prefix=None,
    keep_original=True,
    date_format=None,
):
    """Extract date/time components into separate columns."""

    if column not in df.columns:
        raise ValueError(f"Column '{column}' does not exist.")

    if not parts:
        raise ValueError("Select at least one date/time component.")

    extractors = {
        "year": lambda dates: dates.dt.year,
        "month": lambda dates: dates.dt.month,
        "day": lambda dates: dates.dt.day,
        "weekday": lambda dates: dates.dt.dayofweek,
        "weekday_name": lambda dates: dates.dt.day_name(),
        "month_name": lambda dates: dates.dt.month_name(),
        "hour": lambda dates: dates.dt.hour,
        "minute": lambda dates: dates.dt.minute,
        "second": lambda dates: dates.dt.second,
    }

    unsupported = [part for part in parts if part not in extractors]

    if unsupported:
        raise ValueError(
            f"Unsupported components: {unsupported}. "
            f"Choose from: {list(extractors)}"
        )

    if len(set(parts)) != len(parts):
        raise ValueError("Date/time components must be unique.")

    prefix = prefix or column
    new_columns = [f"{prefix}_{part}" for part in parts]

    conflicts = [
        name for name in new_columns
        if name in df.columns
    ]

    if conflicts:
        raise ValueError(
            f"These output columns already exist: {conflicts}"
        )

    fmt = date_format.strip() if (isinstance(date_format, str) and date_format.strip()) else None
    dates = pd.to_datetime(
        df[column],
        format=fmt if fmt else "mixed",
        errors="coerce",
    )

    result = df.copy()

    for part, new_name in zip(parts, new_columns):
        result[new_name] = extractors[part](dates)

    if not keep_original:
        result = result.drop(columns=[column])

    return result
