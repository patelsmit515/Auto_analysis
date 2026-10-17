
from src.data_loader import load_csv
from src.relationships import check_primary_key, check_foreign_key

students = load_csv("data/sample_students.csv")

print("\n--- Primary Key Check ---")
print(check_primary_key(students, ["Name"]))

print("\n--- Foreign Key Check ---")
print(
    check_foreign_key(
        students,
        "Name",
        students,
        "Name",
    )
)
