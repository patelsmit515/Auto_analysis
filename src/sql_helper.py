import re


SQL_REFERENCE = [
    {
        "keyword": "SELECT",
        "description": "Choose the columns to display.",
        "syntax": "SELECT column1, column2 FROM table_name;",
        "example": "SELECT Name, Score FROM students;",
    },
    {
        "keyword": "FROM",
        "description": "Specify the table to read data from.",
        "syntax": "SELECT columns FROM table_name;",
        "example": "SELECT * FROM students;",
    },
    {
        "keyword": "WHERE",
        "description": "Filter rows using a condition.",
        "syntax": "SELECT columns FROM table_name WHERE condition;",
        "example": "SELECT * FROM students WHERE Score > 80;",
    },
    {
        "keyword": "JOIN",
        "description": "Combine matching rows from tables.",
        "syntax": "SELECT columns FROM table1 JOIN table2 ON condition;",
        "example": (
            "SELECT * FROM students "
            "JOIN courses ON students.Course_ID = courses.Course_ID;"
        ),
    },
    {
        "keyword": "LEFT JOIN",
        "description": "Keep all rows from the left table and matching rows from the right.",
        "syntax": "SELECT columns FROM table1 LEFT JOIN table2 ON condition;",
        "example": (
            "SELECT * FROM students "
            "LEFT JOIN courses ON students.Course_ID = courses.Course_ID;"
        ),
    },
    {
        "keyword": "GROUP BY",
        "description": "Group rows for aggregate calculations.",
        "syntax": "SELECT column, COUNT(*) FROM table_name GROUP BY column;",
        "example": "SELECT City, COUNT(*) FROM students GROUP BY City;",
    },
    {
        "keyword": "ORDER BY",
        "description": "Sort the query results.",
        "syntax": "SELECT columns FROM table_name ORDER BY column ASC;",
        "example": "SELECT * FROM students ORDER BY Score DESC;",
    },
    {
        "keyword": "HAVING",
        "description": "Filter groups after aggregation.",
        "syntax": "SELECT column, COUNT(*) FROM table_name GROUP BY column HAVING COUNT(*) > 1;",
        "example": "SELECT City, COUNT(*) FROM students GROUP BY City HAVING COUNT(*) > 1;",
    },
    {
        "keyword": "DISTINCT",
        "description": "Return unique values or combinations.",
        "syntax": "SELECT DISTINCT column FROM table_name;",
        "example": "SELECT DISTINCT City FROM students;",
    },
    {
        "keyword": "COUNT",
        "description": "Count rows or non-missing values.",
        "syntax": "COUNT(*)",
        "example": "SELECT COUNT(*) FROM students;",
    },
    {
        "keyword": "SUM",
        "description": "Calculate the total of numeric values.",
        "syntax": "SUM(numeric_column)",
        "example": "SELECT SUM(Score) FROM students;",
    },
    {
        "keyword": "AVG",
        "description": "Calculate the average of numeric values.",
        "syntax": "AVG(numeric_column)",
        "example": "SELECT AVG(Score) FROM students;",
    },
    {
        "keyword": "MIN",
        "description": "Return the smallest value.",
        "syntax": "MIN(column)",
        "example": "SELECT MIN(Score) FROM students;",
    },
    {
        "keyword": "MAX",
        "description": "Return the largest value.",
        "syntax": "MAX(column)",
        "example": "SELECT MAX(Score) FROM students;",
    },
    {
        "keyword": "AS",
        "description": "Give a column or table an alias.",
        "syntax": "column_name AS alias",
        "example": "SELECT AVG(Score) AS Average_Score FROM students;",
    },
    {
        "keyword": "LIMIT",
        "description": "Limit the number of returned rows.",
        "syntax": "SELECT columns FROM table_name LIMIT number;",
        "example": "SELECT * FROM students LIMIT 5;",
    },
    {
        "keyword": "AND",
        "description": "Require both conditions to be true.",
        "syntax": "condition1 AND condition2",
        "example": "WHERE Score > 80 AND Age >= 20",
    },
    {
        "keyword": "OR",
        "description": "Require at least one condition to be true.",
        "syntax": "condition1 OR condition2",
        "example": "WHERE City = 'Surat' OR City = 'Mumbai'",
    },
    {
        "keyword": "CASE",
        "description": "Create conditional results.",
        "syntax": "CASE WHEN condition THEN result ELSE other_result END",
        "example": (
            "SELECT Name, CASE WHEN Score >= 80 THEN 'High' "
            "ELSE 'Other' END AS Score_Category FROM students;"
        ),
    },
]


def get_sql_reference(term=None):
    """Return all SQL references or filter them by keyword or description."""

    if not term or not term.strip():
        return SQL_REFERENCE.copy()

    search_term = term.strip().lower()

    return [
        item
        for item in SQL_REFERENCE
        if search_term in item["keyword"].lower()
        or search_term in item["description"].lower()
        or search_term in item["syntax"].lower()
    ]


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
                item["description"],
            )

    return {
        "context": context,
        "suggestions": suggestions,
    }
