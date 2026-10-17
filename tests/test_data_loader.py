from src.data_loader import load_csv, inspect_data

df = load_csv("data/sample_students.csv")

print("\n--- Dataset ---")
print(df)

print("\n--- Inspection ---")
print(inspect_data(df))
