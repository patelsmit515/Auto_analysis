
"""Validate datasets before processing."""


def validate_data(df):
    """Return validation errors and data quality warnings."""

    errors = []
    warnings = []

    # Check whether the dataset has usable rows and columns.
    if df.empty:
        errors.append("The dataset has no rows.")

    if len(df.columns) == 0:
        errors.append("The dataset has no columns.")

    # Check for duplicate column names.
    if df.columns.duplicated().any():
        duplicate_columns = (
            df.columns[df.columns.duplicated()].tolist()
        )
        errors.append(
            f"The dataset contains duplicate column names: "
            f"{duplicate_columns}."
        )

    # Check for columns containing only missing values.
    empty_columns = [
        column
        for column in df.columns
        if df[column].isnull().all()
    ]

    if empty_columns:
        warnings.append(
            f"These columns contain only missing values: "
            f"{empty_columns}."
        )

    # Check for missing values.
    missing_count = int(df.isnull().sum().sum())

    if missing_count > 0:
        warnings.append(
            f"The dataset contains {missing_count} missing values."
        )

    # Check for duplicate rows.
    duplicate_count = int(df.duplicated().sum())

    if duplicate_count > 0:
        warnings.append(
            f"The dataset contains {duplicate_count} duplicate rows."
        )

    # Warn when the dataset is small.
    if 0 < len(df) < 10:
        warnings.append(
            "The dataset contains fewer than 10 rows. "
            "Analysis results may be less reliable."
        )

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }
