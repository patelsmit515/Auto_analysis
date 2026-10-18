from src.data_loader import load_csv
from src.sql_engine import run_query

students = load_csv("data/sample_students.csv")

query = """
SELECT City, AVG(Score) AS Average_Score
FROM students
GROUP BY City
"""

print("\n--- SQL Results ---")
print(run_query(query, {"students": students}))
