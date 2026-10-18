import io
import unittest
import pandas as pd

from src.cleaning import (
    detect_duplicates,
    remove_duplicates,
    edit_cell,
    split_column,
    convert_datetime_column,
)
from src.relationships import evaluate_primary_keys
from src.data_loader import load_csv


class TestImprovements(unittest.TestCase):

    def test_detect_duplicates_with_subset(self):
        df = pd.DataFrame({
            "Student_ID": ["S001", "S002", "S003", "S004", "S005", "S009"],
            "Name": ["Aman", "Rohan", "Priya", "Aman Mehta", "Ananya", "Aman Mehta"],
            "Age": [20, 21, 20, 22, 21, 22],
            "City": ["Delhi", "Mumbai", "Delhi", "Delhi", "Pune", "Delhi"],
        })

        # When checking all columns, S004 and S009 are NOT duplicates because Student_ID differs
        all_res = detect_duplicates(df, subset=None)
        self.assertEqual(all_res["duplicate_count"], 0)

        # When checking subset [Name, Age, City], S004 and S009 ARE detected as duplicates!
        subset_res = detect_duplicates(df, subset=["Name", "Age", "City"], keep="first")
        self.assertEqual(subset_res["duplicate_count"], 1)
        self.assertEqual(subset_res["total_rows"], 6)

        # Remove duplicates with keep="first" preserves S004 and removes S009
        cleaned_first = remove_duplicates(df, subset=["Name", "Age", "City"], keep="first")
        self.assertEqual(len(cleaned_first), 5)
        self.assertIn("S004", cleaned_first["Student_ID"].values)
        self.assertNotIn("S009", cleaned_first["Student_ID"].values)

        # Remove duplicates with keep="last" preserves S009 and removes S004
        cleaned_last = remove_duplicates(df, subset=["Name", "Age", "City"], keep="last")
        self.assertEqual(len(cleaned_last), 5)
        self.assertIn("S009", cleaned_last["Student_ID"].values)
        self.assertNotIn("S004", cleaned_last["Student_ID"].values)

    def test_edit_cell(self):
        df = pd.DataFrame({
            "ID": [1, 2, 3],
            "Name": ["Alice", "Bob", "Charlie"],
            "Score": [85.5, 90.0, 78.0],
        })

        # 1. Edit a text cell
        res1 = edit_cell(df, row_index=1, column="Name", new_value="Robert")
        self.assertEqual(res1.at[1, "Name"], "Robert")

        # 2. Edit a numeric cell
        res2 = edit_cell(df, row_index=0, column="Score", new_value=99.5)
        self.assertEqual(res2.at[0, "Score"], 99.5)

        # 3. Numeric cell validation error on invalid input
        with self.assertRaises(ValueError):
            edit_cell(df, row_index=0, column="Score", new_value="not_a_number")

        # 4. Out of bounds row index error
        with self.assertRaises(ValueError):
            edit_cell(df, row_index=10, column="Name", new_value="Nobody")

        # 5. Nonexistent column error
        with self.assertRaises(ValueError):
            edit_cell(df, row_index=0, column="Ghost", new_value="Value")

    def test_split_column_multiple_separators(self):
        df = pd.DataFrame({
            "Skills": ["Python;SQL,Excel", "Java,C++;HTML", "Ruby"],
        })

        # Multiple separators in a single operation: [';', ',']
        res = split_column(df, column="Skills", separator=[";", ","], new_columns=["S1", "S2", "S3"])
        self.assertIn("S1", res.columns)
        self.assertIn("S2", res.columns)
        self.assertIn("S3", res.columns)
        self.assertEqual(res.at[0, "S1"], "Python")
        self.assertEqual(res.at[0, "S2"], "SQL")
        self.assertEqual(res.at[0, "S3"], "Excel")

    def test_datetime_conversion_handling(self):
        df = pd.DataFrame({
            "Date": ["2023-01-01 14:30:00", "invalid-date", "2024-05-20", "", None],
        })

        # 1. errors='raise' must reject invalid dates with a descriptive message
        with self.assertRaises(ValueError) as ctx:
            convert_datetime_column(df, column="Date", errors="raise")
        self.assertIn("invalid date value", str(ctx.exception).lower())

        # 2. errors='coerce' turns invalid dates into NaT while parsing valid datetimes
        res = convert_datetime_column(df, column="Date", errors="coerce", new_column="ParsedDate")
        self.assertTrue(pd.isna(res.at[1, "ParsedDate"]))
        self.assertTrue(pd.isna(res.at[3, "ParsedDate"]))
        self.assertTrue(pd.isna(res.at[4, "ParsedDate"]))
        self.assertFalse(pd.isna(res.at[0, "ParsedDate"]))
        self.assertFalse(pd.isna(res.at[2, "ParsedDate"]))

        # 3. Preserves time components without discarding them
        first_val = res.at[0, "ParsedDate"]
        self.assertEqual(first_val.hour, 14)
        self.assertEqual(first_val.minute, 30)

    def test_evaluate_primary_keys(self):
        df = pd.DataFrame({
            "ID": ["A1", "A2", "A3"],
            "Name": ["Alice", "Bob", "Alice"],
            "Email": ["a@x.com", None, "c@x.com"],
            "City": ["NY", "SF", "LA"],
        })

        eval_res = evaluate_primary_keys(df)
        eligible = [c["column"] for c in eval_res["eligible_columns"]]
        ineligible = [c["column"] for c in eval_res["ineligible_columns"]]

        self.assertIn("ID", eligible)
        self.assertIn("City", eligible)
        self.assertIn("Name", ineligible)  # duplicates
        self.assertIn("Email", ineligible)  # missing values
        self.assertIn("disclaimer", eval_res)

    def test_html_upload_rejection(self):
        html_content = b"<!DOCTYPE html><html><head><title>Test Page</title></head><body><h1>Hello</h1></body></html>"
        with self.assertRaises(ValueError) as ctx:
            load_csv(io.BytesIO(html_content))
        self.assertIn("HTML webpage", str(ctx.exception))

    def test_empty_csv_rejection(self):
        empty_content = b""
        with self.assertRaises(ValueError) as ctx:
            load_csv(io.BytesIO(empty_content))
        self.assertIn("completely empty", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
