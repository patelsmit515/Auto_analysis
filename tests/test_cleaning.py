
import pandas as pd
from src.data_loader import load_csv
from src.cleaning import (
    fill_missing_values,
    remove_duplicates,
    rename_columns,
    convert_column_type,
    drop_columns,
    filter_rows,
    split_column,
    combine_columns,
    convert_datetime_column,
    extract_datetime_parts,
)

df = load_csv("data/sample_students.csv")

print("\n--- Fill Missing Values ---")
print(fill_missing_values(df, ["Age"], strategy="mean"))

print("\n--- Remove Duplicates ---")
print(remove_duplicates(df))

print("\n--- Rename Columns ---")
print(rename_columns(df, {"Score": "Marks"}))

print("\n--- Convert Column Type ---")
print(convert_column_type(df, "Age", "integer").dtypes)

print("\n--- Drop Columns ---")
print(drop_columns(df, ["City"]))

print("\n--- Filter Rows ---")
print(filter_rows(df, "Score", ">", 80))

print("\n--- Split Text Column ---")
names_df = split_column(
    df,
    column="Name",
    separator=" ",
    new_columns=["First_Name", "Last_Name"],
)
print(names_df)

print("\n--- Combine Columns ---")
combined_df = combine_columns(
    names_df,
    columns=["First_Name", "Last_Name"],
    new_column="Full_Name",
    separator=" ",
)
print(combined_df)

print("\n--- Convert Date Column ---")
date_df = pd.DataFrame({
    "Date_Text": [
        "2025-08-14 16:35:20",
        "2024-01-05 09:15:00",
        "invalid-date",
    ]
})
converted_df = convert_datetime_column(
    date_df,
    column="Date_Text",
    date_format="%Y-%m-%d %H:%M:%S",
    errors="coerce",
)
print(converted_df)
print(converted_df.dtypes)

print("\n--- Extract Date/Time Parts ---")
parts_df = extract_datetime_parts(
    date_df,
    column="Date_Text",
    parts=["year", "month", "day", "hour", "minute"],
    prefix="Date",
    date_format="%Y-%m-%d %H:%M:%S",
)
print(parts_df)
