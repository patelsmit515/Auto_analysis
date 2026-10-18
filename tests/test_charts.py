
from src.data_loader import load_csv
from src.charts import prepare_chart

df = load_csv("data/sample_students.csv")

print("\n--- Bar Chart ---")
print(prepare_chart(df, "bar", "City"))

print("\n--- Histogram ---")
print(prepare_chart(df, "histogram", "Age"))

print("\n--- Scatter Plot ---")
print(prepare_chart(df, "scatter", "Age", "Score"))

print("\n--- Line Chart ---")
print(prepare_chart(df, "line", "Age", "Score"))

print("\n--- Pie Chart ---")
print(prepare_chart(df, "pie", "City"))

print("\n--- Box Plot ---")
print(prepare_chart(df, "box", "City", "Score"))

print("\n--- Invalid Chart Test ---")
try:
    prepare_chart(df, "unknown", "City")
except ValueError as error:
    print(error)
