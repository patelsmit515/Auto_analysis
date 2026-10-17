def validate_data(df):
    """Return errors and warnings about a dataset."""

    errors = []
    warnings = []

    if df.empty:
        errors.append("The dataset has no rows.")

    if len(df.columns) == 0:
        errors.append("The dataset has no columns.")

    if df.columns.duplicated().any():
        errors.append("The dataset contains duplicate column names.")

    if df.isnull().sum().sum() > 0:
        warnings.append("The dataset contains missing values.")

    if df.duplicated().sum() > 0:
        warnings.append("The dataset contains duplicate rows.")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }
