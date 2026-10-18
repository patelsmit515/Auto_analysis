
"""Prepare chart data based on the user's selections."""

import pandas as pd


SUPPORTED_CHARTS = [
    "bar",
    "line",
    "scatter",
    "histogram",
    "pie",
    "box",
]


def prepare_chart(df, chart_type, x_column, y_column=None):
    """Validate chart selections and return JSON-safe chart data."""

    if chart_type not in SUPPORTED_CHARTS:
        raise ValueError(
            f"Unsupported chart type. Choose from: {SUPPORTED_CHARTS}"
        )

    if x_column not in df.columns:
        raise ValueError(f"Column '{x_column}' does not exist.")

    if y_column is not None and y_column not in df.columns:
        raise ValueError(f"Column '{y_column}' does not exist.")

    if chart_type in ["scatter", "line", "box"] and y_column is None:
        raise ValueError(
            f"The {chart_type} chart requires a Y-axis column."
        )

    if chart_type == "scatter":
        if not pd.api.types.is_numeric_dtype(df[x_column]):
            raise ValueError("Scatter plots require a numeric X-axis.")

        if not pd.api.types.is_numeric_dtype(df[y_column]):
            raise ValueError("Scatter plots require a numeric Y-axis.")

    if chart_type == "line" and not pd.api.types.is_numeric_dtype(df[y_column]):
        raise ValueError("Line charts require a numeric Y-axis.")

    if chart_type == "histogram":
        if not pd.api.types.is_numeric_dtype(df[x_column]):
            raise ValueError("Histograms require a numeric column.")

    if chart_type == "box" and not pd.api.types.is_numeric_dtype(df[y_column]):
        raise ValueError("Box plots require a numeric Y-axis.")

    if chart_type == "pie" and y_column is not None:
        if not pd.api.types.is_numeric_dtype(df[y_column]):
            raise ValueError("Pie charts require a numeric Y-axis.")

    if chart_type in ["bar", "pie"] and y_column is None:
        chart_df = (
            df[x_column]
            .value_counts(dropna=False)
            .rename_axis(x_column)
            .reset_index(name="count")
        )
        y_column = "count"

    elif chart_type == "histogram":
        chart_df = df[[x_column]].dropna()

    elif chart_type == "box":
        chart_df = df[[y_column]].dropna()

    else:
        columns = [x_column]

        if y_column is not None:
            columns.append(y_column)

        chart_df = df[columns].dropna()

    # Convert NaN and other missing values to JSON-compatible null values.
    chart_df = chart_df.astype(object).where(chart_df.notna(), None)

    return {
        "chart_type": chart_type,
        "x_column": x_column,
        "y_column": y_column,
        "data": chart_df.to_dict(orient="records"),
    }
