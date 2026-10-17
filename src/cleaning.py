import pandas as pd


def fill_missing_values(df, columns=None, strategy="mean", fill_value=None):
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
                raise ValueError(f"Median requires a numeric column: {column}")
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


def remove_duplicates(df):
    """Remove duplicate rows."""

    return df.drop_duplicates().reset_index(drop=True)


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
        cleaned_df[column] = pd.to_datetime(
            cleaned_df[column], errors="raise"
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
