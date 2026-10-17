
from src.data_loader import load_csv
from src.cleaning import (
    fill_missing_values,
    remove_duplicates,
    rename_columns,
    convert_column_type,
    drop_columns,
    filter_rows,
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
