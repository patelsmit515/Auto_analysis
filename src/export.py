from pathlib import Path

def export_csv(df, file_path):
    """Save a DataFrame as a CSV file."""

    path = Path(file_path)

    if path.suffix.lower() != ".csv":
        raise ValueError("The output file must have a .csv extension.")

    path.parent.mkdir(parents=True, exist_ok=True)

    df.to_csv(path, index=False)

    return str(path)
