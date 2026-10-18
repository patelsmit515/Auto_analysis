import json
import unittest
import urllib.request
import urllib.error


BASE_URL = "http://127.0.0.1:8000"


def make_request(method, path, body=None, content_type="application/json"):
    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None and content_type == "application/json" else body
    req = urllib.request.Request(url, data=data, method=method)
    if content_type:
        req.add_header("Content-Type", content_type)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8")
        try:
            return err.code, json.loads(raw)
        except Exception:
            return err.code, {"detail": raw}


class TestApiLive(unittest.TestCase):

    def test_health_check(self):
        status, data = make_request("GET", "/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(data.get("status"), "healthy")

    def test_sql_reference_and_categories(self):
        # 1. Categories
        status, data = make_request("GET", "/api/sql-reference/categories")
        self.assertEqual(status, 200)
        self.assertIn("categories", data)
        self.assertIn("Basic Syntax", data["categories"])
        self.assertIn("Window Functions", data["categories"])

        # 2. Filter by category
        status, data = make_request("GET", "/api/sql-reference?category=Filtering")
        self.assertEqual(status, 200)
        refs = data.get("references", [])
        self.assertTrue(all(r["category"] == "Filtering" for r in refs))

    def test_table_data_pagination_and_search(self):
        # Load sample
        status, _ = make_request("POST", "/api/datasets/load-sample", body={"filename": "test_workflow.csv"})
        self.assertEqual(status, 200)

        # 1. Test paginated data retrieval (Fixed offset bug)
        status, data = make_request("GET", "/api/datasets/test_workflow/data?page=1&page_size=5")
        self.assertEqual(status, 200)
        self.assertEqual(len(data["rows"]), 5)
        self.assertEqual(data["total_rows"], 12)
        self.assertEqual(data["total_pages"], 3)
        self.assertIn("_row_index", data["rows"][0])
        self.assertEqual(data["rows"][0]["_row_index"], 0)

        # 2. Page 2
        status, data2 = make_request("GET", "/api/datasets/test_workflow/data?page=2&page_size=5")
        self.assertEqual(status, 200)
        self.assertEqual(len(data2["rows"]), 5)
        self.assertEqual(data2["rows"][0]["_row_index"], 5)

        # 3. Row search
        status, search_res = make_request("GET", "/api/datasets/test_workflow/data?search=S004")
        self.assertEqual(status, 200)
        self.assertEqual(len(search_res["rows"]), 1)
        self.assertEqual(search_res["rows"][0]["Student_ID"], "S004")

        # Clean up
        make_request("DELETE", "/api/datasets/test_workflow")

    def test_date_conversion_api(self):
        # Load workflow dataset with invalid-date
        status, _ = make_request("POST", "/api/datasets/load-sample", body={"filename": "test_workflow.csv"})
        self.assertEqual(status, 200)

        # 1. Test errors="raise" rejects invalid-date with clear explanation without modifying working copy
        status_raise, res_raise = make_request(
            "POST",
            "/api/clean/convert-datetime",
            body={
                "dataset_name": "test_workflow",
                "column": "Registration_Date",
                "errors": "raise",
                "apply": True,
            },
        )
        self.assertEqual(status_raise, 400)
        self.assertIn("invalid date value", res_raise.get("detail", "").lower())

        # 2. Test errors="coerce" converts invalid dates into nulls and reports conversion stats
        status_coerce, res_coerce = make_request(
            "POST",
            "/api/clean/convert-datetime",
            body={
                "dataset_name": "test_workflow",
                "column": "Registration_Date",
                "errors": "coerce",
                "apply": True,
            },
        )
        self.assertEqual(status_coerce, 200)
        self.assertIn("stats", res_coerce)
        stats = res_coerce["stats"]
        self.assertEqual(stats["total_rows"], 12)
        self.assertGreaterEqual(stats["successfully_converted"], 11)
        self.assertGreaterEqual(stats["invalid_values"], 1)

        # 3. Verify in DuckDB that converted column retains hours, minutes, and seconds
        sql_status, sql_res = make_request(
            "POST",
            "/api/sql-query",
            body={"query": "SELECT EXTRACT(hour FROM CAST(Registration_Date AS TIMESTAMP)) AS hr FROM test_workflow WHERE Student_ID = 'S001';"},
        )
        self.assertEqual(sql_status, 200)
        self.assertEqual(sql_res["rows"][0]["hr"], 16)

        # Clean up
        make_request("DELETE", "/api/datasets/test_workflow")

    def test_session_lifecycle_cell_edit_undo_and_sql_isolation(self):
        # 1. Load test_workflow.csv and test_courses.csv
        status1, d1 = make_request("POST", "/api/datasets/load-sample", body={"filename": "test_workflow.csv"})
        self.assertEqual(status1, 200)
        status2, d2 = make_request("POST", "/api/datasets/load-sample", body={"filename": "test_courses.csv"})
        self.assertEqual(status2, 200)

        # 2. Verify Duplicate Detection with S004 and S009
        dup_status, dup_res = make_request(
            "POST",
            "/api/clean/detect-duplicates",
            body={
                "dataset_name": "test_workflow",
                "subset": ["Full_Name", "Age", "City"],
                "keep": "first",
            },
        )
        self.assertEqual(dup_status, 200)
        self.assertGreaterEqual(dup_res["duplicate_count"], 1)
        duplicate_ids = [r.get("Student_ID") for r in dup_res.get("duplicate_rows", [])]
        self.assertIn("S009", duplicate_ids)

        # 3. Foreign Key Reference Check: C99 is missing from test_courses
        fk_status, fk_res = make_request(
            "POST",
            "/api/relationships/check-fk",
            body={
                "parent_dataset_name": "test_courses",
                "parent_column": "Course_ID",
                "child_dataset_name": "test_workflow",
                "child_column": "Course_ID",
            },
        )
        self.assertEqual(fk_status, 200)
        self.assertFalse(fk_res["valid"])
        self.assertIn("C99", fk_res["missing_values"])

        # 4. Primary Key Evaluation
        pk_status, pk_res = make_request("GET", "/api/relationships/test_workflow/evaluate-pk")
        self.assertEqual(pk_status, 200)
        eligible_cols = [c["column"] for c in pk_res["eligible_columns"]]
        self.assertIn("Student_ID", eligible_cols)
        self.assertIn("disclaimer", pk_res)

        # 5. Cell editing and Undo
        edit_status, edit_res = make_request(
            "POST",
            "/api/datasets/test_workflow/edit-cell",
            body={"row_index": 0, "column": "Score", "new_value": 100.0},
        )
        self.assertEqual(edit_status, 200)
        self.assertTrue(edit_res.get("can_undo", False))

        # Query DuckDB
        sql_status, sql_res = make_request(
            "POST",
            "/api/sql-query",
            body={"query": "SELECT Score FROM test_workflow WHERE Student_ID = 'S001';"},
        )
        self.assertEqual(sql_status, 200)
        self.assertEqual(str(sql_res["rows"][0]["Score"]), "100.0")

        # Undo the edit
        undo_status, undo_res = make_request("POST", "/api/datasets/test_workflow/undo")
        self.assertEqual(undo_status, 200)

        # Verify undone value restored
        sql_status2, sql_res2 = make_request(
            "POST",
            "/api/sql-query",
            body={"query": "SELECT Score FROM test_workflow WHERE Student_ID = 'S001';"},
        )
        self.assertEqual(sql_status2, 200)
        self.assertEqual(str(sql_res2["rows"][0]["Score"]), "85")

        # 6. Delete test_courses dataset and verify SQL tables are clean
        del_status, _ = make_request("DELETE", "/api/datasets/test_courses")
        self.assertEqual(del_status, 200)

        query_deleted_status, query_deleted_res = make_request(
            "POST",
            "/api/sql-query",
            body={"query": "SELECT * FROM test_courses;"},
        )
        self.assertEqual(query_deleted_status, 400)
        detail_msg = query_deleted_res.get("detail", "").lower()
        self.assertTrue("does not exist" in detail_msg or "not found" in detail_msg)

        # 7. Clear Session and test total isolation
        clear_status, clear_res = make_request("POST", "/api/datasets/clear-session")
        self.assertEqual(clear_status, 200)

        # Verify 0 datasets in session
        list_status, list_res = make_request("GET", "/api/datasets")
        self.assertEqual(list_status, 200)
        self.assertEqual(len(list_res["datasets"]), 0)

        # Querying with no session datasets must return 400
        sql_empty_status, sql_empty_res = make_request(
            "POST",
            "/api/sql-query",
            body={"query": "SELECT * FROM test_workflow;"},
        )
        self.assertEqual(sql_empty_status, 400)
        self.assertIn("no datasets available", sql_empty_res.get("detail", "").lower())

        # 8. Upload new dataset after clearing session: only the new dataset is registered
        status_new, _ = make_request("POST", "/api/datasets/load-sample", body={"filename": "sample_students.csv"})
        self.assertEqual(status_new, 200)

        list_status2, list_res2 = make_request("GET", "/api/datasets")
        self.assertEqual(list_status2, 200)
        self.assertEqual(len(list_res2["datasets"]), 1)
        self.assertEqual(list_res2["datasets"][0]["name"], "sample_students")

        # Clean up
        make_request("POST", "/api/datasets/clear-session")

    def test_saved_files_and_path_protection(self):
        # 1. List saved files
        status, data = make_request("GET", "/api/saved-files")
        self.assertEqual(status, 200)
        self.assertIn("exports", data)
        self.assertIn("root_data", data)

        # 2. Path traversal rejection
        status_traversal, _ = make_request(
            "POST",
            "/api/saved-files/delete",
            body={"filename": "../../../secrets.txt", "folder": "exports"},
        )
        self.assertEqual(status_traversal, 400)


if __name__ == "__main__":
    unittest.main()
