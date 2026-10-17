import duckdb


def run_query(query, datasets):
    """Run SQL against a dictionary of table names and DataFrames."""

    connection = duckdb.connect(database=":memory:")

    try:
        for table_name, df in datasets.items():
            connection.register(table_name, df)

        result = connection.execute(query).fetchdf()

        return result

    finally:
        connection.close()
