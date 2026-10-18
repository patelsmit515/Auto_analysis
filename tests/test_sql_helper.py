
from src.sql_helper import get_sql_reference, suggest_sql


schemas = {
    "students": ["Name", "Age", "City", "Score", "Course_ID"],
    "courses": ["Course_ID", "Course_Name"],
}


print("\n--- SQL Reference: SELECT ---")
print(get_sql_reference("SELECT"))

print("\n--- SQL Reference: JOIN ---")
print(get_sql_reference("JOIN"))

print("\n--- Suggestions: SELECT ---")
print(suggest_sql("SELECT ", schemas))

print("\n--- Suggestions: FROM ---")
print(suggest_sql("SELECT Name FROM ", schemas))

print("\n--- Suggestions: Partial Table Name ---")
print(suggest_sql("SELECT * FROM stu", schemas))

print("\n--- Suggestions: WHERE ---")
print(suggest_sql("SELECT * FROM students WHERE ", schemas))

print("\n--- Suggestions: GROUP BY ---")
print(suggest_sql("SELECT City, COUNT(*) FROM students GROUP BY ", schemas))

print("\n--- Suggestions: ORDER BY ---")
print(suggest_sql("SELECT * FROM students ORDER BY ", schemas))

print("\n--- Suggestions: Table-Specific Column ---")
print(suggest_sql("SELECT students.", schemas))

print("\n--- Suggestions: Partial Column Name ---")
print(suggest_sql("SELECT students.Sc", schemas))
