from src.data_loader import load_csv
from src.validation import validate_data

df = load_csv("data/sample_students.csv")

print("\n--- Validation Results ---")
print(validate_data(df))
