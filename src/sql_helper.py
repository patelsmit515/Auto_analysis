import re


SQL_REFERENCE = [
    # 1. Basic Syntax
    {
        "category": "Basic Syntax",
        "keyword": "SELECT",
        "description": "Choose the columns to display.",
        "syntax": "SELECT column1, column2 FROM table_name;",
        "example": "SELECT Name, Score FROM students;",
    },
    {
        "category": "Basic Syntax",
        "keyword": "FROM",
        "description": "Specify the table to read data from.",
        "syntax": "SELECT columns FROM table_name;",
        "example": "SELECT * FROM students;",
    },
    {
        "category": "Basic Syntax",
        "keyword": "DISTINCT",
        "description": "Return unique values or combinations without duplicates.",
        "syntax": "SELECT DISTINCT column FROM table_name;",
        "example": "SELECT DISTINCT City FROM students;",
    },
    {
        "category": "Basic Syntax",
        "keyword": "AS",
        "description": "Give a column or table an alias name.",
        "syntax": "column_name AS alias",
        "example": "SELECT AVG(Score) AS Average_Score FROM students;",
    },
    {
        "category": "Basic Syntax",
        "keyword": "LIMIT",
        "description": "Limit the maximum number of returned rows.",
        "syntax": "SELECT columns FROM table_name LIMIT number;",
        "example": "SELECT * FROM students LIMIT 5;",
    },

    # 2. Filtering
    {
        "category": "Filtering",
        "keyword": "WHERE",
        "description": "Filter rows using a condition.",
        "syntax": "SELECT columns FROM table_name WHERE condition;",
        "example": "SELECT * FROM students WHERE Score > 80;",
    },
    {
        "category": "Filtering",
        "keyword": "AND",
        "description": "Require both conditions to evaluate to true.",
        "syntax": "condition1 AND condition2",
        "example": "WHERE Score > 80 AND Age >= 20",
    },
    {
        "category": "Filtering",
        "keyword": "OR",
        "description": "Require at least one condition to evaluate to true.",
        "syntax": "condition1 OR condition2",
        "example": "WHERE City = 'Surat' OR City = 'Mumbai'",
    },
    {
        "category": "Filtering",
        "keyword": "NOT",
        "description": "Invert a boolean condition.",
        "syntax": "NOT condition",
        "example": "WHERE NOT (City = 'Surat')",
    },
    {
        "category": "Filtering",
        "keyword": "IN",
        "description": "Check if a value matches any value in a list or subquery.",
        "syntax": "column IN (val1, val2, ...)",
        "example": "WHERE City IN ('Surat', 'Mumbai', 'Pune')",
    },
    {
        "category": "Filtering",
        "keyword": "BETWEEN",
        "description": "Filter values within an inclusive range.",
        "syntax": "column BETWEEN low AND high",
        "example": "WHERE Age BETWEEN 20 AND 25",
    },
    {
        "category": "Filtering",
        "keyword": "LIKE",
        "description": "Pattern match strings using % (wildcard) and _ (single char).",
        "syntax": "column LIKE pattern",
        "example": "WHERE Full_Name LIKE 'A%'",
    },
    {
        "category": "Filtering",
        "keyword": "IS NULL",
        "description": "Test whether a column value is missing / NULL.",
        "syntax": "column IS NULL / column IS NOT NULL",
        "example": "WHERE City IS NULL",
    },

    # 3. Sorting
    {
        "category": "Sorting",
        "keyword": "ORDER BY",
        "description": "Sort the query results by one or more columns.",
        "syntax": "ORDER BY column [ASC | DESC]",
        "example": "SELECT * FROM students ORDER BY Score DESC, Name ASC;",
    },
    {
        "category": "Sorting",
        "keyword": "ASC",
        "description": "Sort values in ascending order (default).",
        "syntax": "ORDER BY column ASC",
        "example": "ORDER BY Age ASC",
    },
    {
        "category": "Sorting",
        "keyword": "DESC",
        "description": "Sort values in descending order (highest first).",
        "syntax": "ORDER BY column DESC",
        "example": "ORDER BY Score DESC",
    },

    # 4. Aggregations
    {
        "category": "Aggregations",
        "keyword": "COUNT",
        "description": "Count rows or non-null values.",
        "syntax": "COUNT(*) / COUNT(column)",
        "example": "SELECT COUNT(*) FROM students;",
    },
    {
        "category": "Aggregations",
        "keyword": "SUM",
        "description": "Calculate total sum of numeric values.",
        "syntax": "SUM(numeric_column)",
        "example": "SELECT SUM(Score) FROM students;",
    },
    {
        "category": "Aggregations",
        "keyword": "AVG",
        "description": "Calculate mean average of numeric values.",
        "syntax": "AVG(numeric_column)",
        "example": "SELECT AVG(Score) FROM students;",
    },
    {
        "category": "Aggregations",
        "keyword": "MIN",
        "description": "Return the minimum / smallest value in a column.",
        "syntax": "MIN(column)",
        "example": "SELECT MIN(Score) FROM students;",
    },
    {
        "category": "Aggregations",
        "keyword": "MAX",
        "description": "Return the maximum / largest value in a column.",
        "syntax": "MAX(column)",
        "example": "SELECT MAX(Score) FROM students;",
    },

    # 5. Grouping
    {
        "category": "Grouping",
        "keyword": "GROUP BY",
        "description": "Group rows that have the same values into summary rows.",
        "syntax": "SELECT column, COUNT(*) FROM table GROUP BY column;",
        "example": "SELECT City, COUNT(*) FROM students GROUP BY City;",
    },
    {
        "category": "Grouping",
        "keyword": "HAVING",
        "description": "Filter aggregated groups after GROUP BY.",
        "syntax": "GROUP BY column HAVING aggregate_condition",
        "example": "SELECT City, COUNT(*) FROM students GROUP BY City HAVING COUNT(*) > 1;",
    },

    # 6. Joins
    {
        "category": "Joins",
        "keyword": "JOIN",
        "description": "Inner join: return rows when key matches in both tables.",
        "syntax": "SELECT * FROM t1 JOIN t2 ON t1.id = t2.id;",
        "example": "SELECT * FROM students JOIN courses ON students.Course_ID = courses.Course_ID;",
    },
    {
        "category": "Joins",
        "keyword": "LEFT JOIN",
        "description": "Keep all rows from left table and matched rows from right table.",
        "syntax": "SELECT * FROM t1 LEFT JOIN t2 ON t1.id = t2.id;",
        "example": "SELECT * FROM students LEFT JOIN courses ON students.Course_ID = courses.Course_ID;",
    },
    {
        "category": "Joins",
        "keyword": "RIGHT JOIN",
        "description": "Keep all rows from right table and matched rows from left table.",
        "syntax": "SELECT * FROM t1 RIGHT JOIN t2 ON t1.id = t2.id;",
        "example": "SELECT * FROM students RIGHT JOIN courses ON students.Course_ID = courses.Course_ID;",
    },
    {
        "category": "Joins",
        "keyword": "FULL OUTER JOIN",
        "description": "Return all rows when there is a match in either left or right table.",
        "syntax": "SELECT * FROM t1 FULL OUTER JOIN t2 ON t1.id = t2.id;",
        "example": "SELECT * FROM students FULL OUTER JOIN courses ON students.Course_ID = courses.Course_ID;",
    },
    {
        "category": "Joins",
        "keyword": "CROSS JOIN",
        "description": "Cartesian product of both tables.",
        "syntax": "SELECT * FROM t1 CROSS JOIN t2;",
        "example": "SELECT * FROM students CROSS JOIN courses;",
    },

    # 7. Conditional Expressions
    {
        "category": "Conditionals",
        "keyword": "CASE",
        "description": "Conditional branching logic (IF-THEN-ELSE).",
        "syntax": "CASE WHEN condition THEN val1 ELSE val2 END",
        "example": "SELECT Name, CASE WHEN Score >= 80 THEN 'Pass' ELSE 'Fail' END AS Status FROM students;",
    },

    # 8. Null Handling
    {
        "category": "Null Handling",
        "keyword": "COALESCE",
        "description": "Return the first non-null argument in a list of expressions.",
        "syntax": "COALESCE(val1, val2, ...)",
        "example": "SELECT Full_Name, COALESCE(City, 'Unknown') AS City FROM students;",
    },
    {
        "category": "Null Handling",
        "keyword": "NULLIF",
        "description": "Return NULL if two expressions are equal; otherwise returns the first.",
        "syntax": "NULLIF(expr1, expr2)",
        "example": "SELECT NULLIF(Score, 0) FROM students;",
    },

    # 9. Text Functions
    {
        "category": "Text Functions",
        "keyword": "LOWER",
        "description": "Convert string to lowercase.",
        "syntax": "LOWER(text_column)",
        "example": "SELECT LOWER(Full_Name) FROM students;",
    },
    {
        "category": "Text Functions",
        "keyword": "UPPER",
        "description": "Convert string to uppercase.",
        "syntax": "UPPER(text_column)",
        "example": "SELECT UPPER(City) FROM students;",
    },
    {
        "category": "Text Functions",
        "keyword": "CONCAT",
        "description": "Concatenate multiple strings together.",
        "syntax": "CONCAT(str1, str2, ...)",
        "example": "SELECT CONCAT(Full_Name, ' - ', City) FROM students;",
    },
    {
        "category": "Text Functions",
        "keyword": "SUBSTRING",
        "description": "Extract substring from text starting at 1-based index.",
        "syntax": "SUBSTRING(str, start, length)",
        "example": "SELECT SUBSTRING(Student_ID, 2, 3) FROM students;",
    },
    {
        "category": "Text Functions",
        "keyword": "TRIM",
        "description": "Remove leading and trailing whitespace.",
        "syntax": "TRIM(str)",
        "example": "SELECT TRIM(Full_Name) FROM students;",
    },
    {
        "category": "Text Functions",
        "keyword": "LENGTH",
        "description": "Return the number of characters in a string.",
        "syntax": "LENGTH(str)",
        "example": "SELECT LENGTH(Full_Name) FROM students;",
    },

    # 10. Numeric Functions
    {
        "category": "Numeric Functions",
        "keyword": "ROUND",
        "description": "Round numeric value to specified decimal places.",
        "syntax": "ROUND(num, decimals)",
        "example": "SELECT ROUND(AVG(Score), 2) FROM students;",
    },
    {
        "category": "Numeric Functions",
        "keyword": "ABS",
        "description": "Return absolute positive value of a number.",
        "syntax": "ABS(num)",
        "example": "SELECT ABS(-42);",
    },
    {
        "category": "Numeric Functions",
        "keyword": "CEIL",
        "description": "Round number up to the nearest integer.",
        "syntax": "CEIL(num)",
        "example": "SELECT CEIL(Score / 10.0) FROM students;",
    },
    {
        "category": "Numeric Functions",
        "keyword": "FLOOR",
        "description": "Round number down to the nearest integer.",
        "syntax": "FLOOR(num)",
        "example": "SELECT FLOOR(Score / 10.0) FROM students;",
    },

    # 11. Date and Time Functions
    {
        "category": "Date & Time",
        "keyword": "CURRENT_DATE",
        "description": "Return current calendar date.",
        "syntax": "CURRENT_DATE",
        "example": "SELECT CURRENT_DATE;",
    },
    {
        "category": "Date & Time",
        "keyword": "DATE_TRUNC",
        "description": "Truncate timestamp to specified interval (year, month, day).",
        "syntax": "DATE_TRUNC('month', timestamp_column)",
        "example": "SELECT DATE_TRUNC('month', CAST(Registration_Date AS TIMESTAMP)) FROM students;",
    },
    {
        "category": "Date & Time",
        "keyword": "EXTRACT",
        "description": "Extract date/time part (year, month, day, hour).",
        "syntax": "EXTRACT(part FROM timestamp_col)",
        "example": "SELECT EXTRACT(year FROM CAST(Registration_Date AS TIMESTAMP)) FROM students;",
    },
    {
        "category": "Date & Time",
        "keyword": "DATEDIFF",
        "description": "Calculate difference between two dates in days/months/years.",
        "syntax": "DATEDIFF('day', start_date, end_date)",
        "example": "SELECT DATEDIFF('day', '2025-01-01', CURRENT_DATE);",
    },

    # 12. Common Table Expressions (WITH)
    {
        "category": "CTEs (WITH)",
        "keyword": "WITH",
        "description": "Define a Common Table Expression (temporary named result set).",
        "syntax": "WITH cte_name AS (SELECT ...) SELECT * FROM cte_name;",
        "example": "WITH top_students AS (SELECT * FROM students WHERE Score >= 85) SELECT * FROM top_students WHERE City = 'Surat';",
    },

    # 13. Subqueries
    {
        "category": "Subqueries",
        "keyword": "EXISTS",
        "description": "Check if a subquery returns any rows.",
        "syntax": "WHERE EXISTS (SELECT 1 FROM other_tbl WHERE ...)",
        "example": "SELECT * FROM students s WHERE EXISTS (SELECT 1 FROM courses c WHERE s.Course_ID = c.Course_ID);",
    },

    # 14. Window Functions
    {
        "category": "Window Functions",
        "keyword": "ROW_NUMBER",
        "description": "Assign sequential integer rank to rows within a partition.",
        "syntax": "ROW_NUMBER() OVER ([PARTITION BY col] ORDER BY col)",
        "example": "SELECT Full_Name, Score, ROW_NUMBER() OVER (ORDER BY Score DESC) AS Rank FROM students;",
    },
    {
        "category": "Window Functions",
        "keyword": "RANK",
        "description": "Assign rank with gaps for ties within an ordered partition.",
        "syntax": "RANK() OVER ([PARTITION BY col] ORDER BY col)",
        "example": "SELECT Full_Name, Score, RANK() OVER (ORDER BY Score DESC) AS Score_Rank FROM students;",
    },

    # 15. Set Operations
    {
        "category": "Set Operations",
        "keyword": "UNION",
        "description": "Combine results of two queries, removing duplicates.",
        "syntax": "SELECT cols FROM t1 UNION SELECT cols FROM t2;",
        "example": "SELECT City FROM students UNION SELECT City FROM teachers;",
    },
    {
        "category": "Set Operations",
        "keyword": "UNION ALL",
        "description": "Combine results of two queries, preserving all rows including duplicates.",
        "syntax": "SELECT cols FROM t1 UNION ALL SELECT cols FROM t2;",
        "example": "SELECT City FROM students UNION ALL SELECT City FROM teachers;",
    },
]

SQL_CATEGORIES = list(dict.fromkeys(item["category"] for item in SQL_REFERENCE))


def get_sql_reference(term=None, category=None):
    """Return SQL references optionally filtered by search term or category."""

    results = SQL_REFERENCE.copy()

    if category and category.strip() and category.strip().lower() != "all":
        cat_lower = category.strip().lower()
        results = [
            item for item in results
            if item.get("category", "").lower() == cat_lower
        ]

    if term and term.strip():
        search_term = term.strip().lower()
        results = [
            item for item in results
            if search_term in item["keyword"].lower()
            or search_term in item["description"].lower()
            or search_term in item["syntax"].lower()
            or search_term in item.get("category", "").lower()
        ]

    return results


def suggest_sql(query, schemas=None):
    """Suggest tables, columns, or SQL keywords based on the query context.

    schemas should map table names to their column names, for example:
    {
        "students": ["Name", "Age", "City", "Score"],
        "courses": ["Course_ID", "Course_Name"]
    }
    """

    query = query or ""
    schemas = schemas or {}

    suggestions = []
    context = "sql_keywords"

    def add_suggestion(label, kind, detail):
        suggestions.append({
            "label": label,
            "kind": kind,
            "detail": detail,
        })

    # Support references such as students.Score.
    qualified_match = re.search(
        r"\b([A-Za-z_]\w*)\.([A-Za-z_]\w*)?$",
        query,
    )

    if qualified_match:
        table_name = qualified_match.group(1)
        column_prefix = qualified_match.group(2) or ""

        if table_name in schemas:
            context = "table_columns"

            for column in schemas[table_name]:
                if column.lower().startswith(column_prefix.lower()):
                    add_suggestion(
                        f"{table_name}.{column}",
                        "column",
                        f"Column from table {table_name}",
                    )

            return {
                "context": context,
                "suggestions": suggestions,
            }

    # Suggest tables after FROM or JOIN, including partially typed names.
    table_match = re.search(
        r"\b(?:FROM|JOIN)\s+([A-Za-z_]\w*)?$",
        query,
        re.IGNORECASE,
    )

    if table_match:
        context = "tables"
        table_prefix = table_match.group(1) or ""

        for table_name in schemas:
            if table_name.lower().startswith(table_prefix.lower()):
                add_suggestion(
                    table_name,
                    "table",
                    "Available dataset",
                )

        return {
            "context": context,
            "suggestions": suggestions,
        }

    # Suggest columns in common column-selection contexts.
    column_contexts = [
        (r"\bSELECT\s*$", "select_columns"),
        (r"\bWHERE\s*$", "where_columns"),
        (r"\bGROUP\s+BY\s*$", "group_by_columns"),
        (r"\bORDER\s+BY\s*$", "order_by_columns"),
        (r"\bHAVING\s*$", "having_columns"),
        (r"\bON\s*$", "join_conditions"),
    ]

    for pattern, matched_context in column_contexts:
        if re.search(pattern, query, re.IGNORECASE):
            context = matched_context

            for table_name, columns in schemas.items():
                for column in columns:
                    add_suggestion(
                        column,
                        "column",
                        f"Column from table {table_name}",
                    )

            return {
                "context": context,
                "suggestions": suggestions,
            }

    # Offer SQL keywords when a keyword is partially typed.
    partial_word = re.search(r"([A-Za-z_]\w*)$", query)
    prefix = partial_word.group(1).lower() if partial_word else ""

    context = "sql_keywords"

    for item in SQL_REFERENCE:
        keyword = item["keyword"]

        if keyword.lower().startswith(prefix):
            add_suggestion(
                keyword,
                "keyword",
                f"[{item.get('category', 'SQL')}] {item['description']}",
            )

    return {
        "context": context,
        "suggestions": suggestions,
    }
