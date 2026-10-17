
"""Check primary keys and foreign-key relationships."""


def check_primary_key(df, columns):
    """Check whether one or more columns form a valid primary key."""

    missing_columns = [
        column for column in columns
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(f"Columns not found: {missing_columns}")

    has_missing = df[columns].isnull().any().any()
    has_duplicates = df.duplicated(subset=columns).any()

    return {
        "columns": columns,
        "valid": not has_missing and not has_duplicates,
        "has_missing_values": bool(has_missing),
        "has_duplicates": bool(has_duplicates),
    }


def check_foreign_key(
    parent_df, parent_column, child_df, child_column
):
    """Check whether child values exist in the parent column."""

    if parent_column not in parent_df.columns:
        raise ValueError(f"Parent column '{parent_column}' not found.")

    if child_column not in child_df.columns:
        raise ValueError(f"Child column '{child_column}' not found.")

    parent_values = set(parent_df[parent_column].dropna())

    child_values = child_df[child_column].dropna()

    missing_values = child_values[
        ~child_values.isin(parent_values)
    ].unique().tolist()

    return {
        "valid": len(missing_values) == 0,
        "parent_column": parent_column,
        "child_column": child_column,
        "missing_values": missing_values,
    }
