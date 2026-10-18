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

    missing_count = int(df[columns].isnull().any(axis=1).sum())
    duplicate_count = int(df.duplicated(subset=columns).sum())

    return {
        "columns": columns,
        "valid": not has_missing and not has_duplicates,
        "has_missing_values": bool(has_missing),
        "has_duplicates": bool(has_duplicates),
        "missing_count": missing_count,
        "duplicate_count": duplicate_count,
    }


def evaluate_primary_keys(df):
    """Automatically evaluate all columns and candidate combinations for primary key eligibility."""

    eligible_columns = []
    ineligible_columns = []

    for col in df.columns:
        missing_count = int(df[col].isnull().sum())
        duplicate_count = int(df.duplicated(subset=[col]).sum())
        has_missing = missing_count > 0
        has_duplicates = duplicate_count > 0

        if not has_missing and not has_duplicates:
            eligible_columns.append({
                "column": col,
                "status": "eligible",
                "unique_count": int(df[col].nunique()),
                "total_rows": len(df),
                "description": "Non-null and 100% unique across all rows.",
            })
        else:
            reasons = []
            if has_missing:
                reasons.append(f"{missing_count} missing value(s)")
            if has_duplicates:
                reasons.append(f"{duplicate_count} duplicate value(s)")
            ineligible_columns.append({
                "column": col,
                "status": "ineligible",
                "missing_count": missing_count,
                "duplicate_count": duplicate_count,
                "reason": " and ".join(reasons),
            })

    # Optional composite primary key check (pairs of 2 columns)
    composite_candidates = []
    cols = list(df.columns)
    if len(cols) >= 2:
        for i in range(min(len(cols), 8)):
            for j in range(i + 1, min(len(cols), 8)):
                pair = [cols[i], cols[j]]
                if not df[pair].isnull().any().any() and not df.duplicated(subset=pair).any():
                    composite_candidates.append(pair)
                    if len(composite_candidates) >= 5:
                        break
            if len(composite_candidates) >= 5:
                break

    return {
        "eligible_columns": eligible_columns,
        "ineligible_columns": ineligible_columns,
        "composite_candidates": composite_candidates,
        "total_columns": len(df.columns),
        "total_rows": len(df),
        "disclaimer": (
            "A column being eligible indicates its values are currently non-null and unique, "
            "but real-world domain knowledge is required to confirm whether it is the true entity identifier."
        ),
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
        "unmatched_count": len(missing_values),
    }
