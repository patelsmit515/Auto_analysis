from src.data_loader import load_csv
from src.cleaning import remove_duplicates
from src.export import export_csv

df = load_csv("data/sample_students.csv")

cleaned_df = remove_duplicates(df)

output_path = export_csv(
    cleaned_df,
    "data/cleaned_students.csv",
)

print(f"\nExport completed: {output_path}")
print("\n--- Exported Data ---")
print(cleaned_df)
