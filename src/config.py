# Project information
PROJECT_NAME = "Auto_analysis"
PROJECT_VERSION = "1.0.0"
PROJECT_DESCRIPTION = "A CSV data cleaning and SQL analysis application."

# File handling
SUPPORTED_FILE_EXTENSIONS = [".csv"]
DEFAULT_ENCODING = "utf-8-sig"
MAX_UPLOAD_SIZE_MB = 50

# Data preview
DEFAULT_PREVIEW_ROWS = 10
MAX_PREVIEW_ROWS = 100

# Data cleaning options
MISSING_VALUE_STRATEGIES = [
    "drop_rows",
    "fill_value",
    "mean",
    "median",
    "mode",
]

DUPLICATE_HANDLING_OPTIONS = [
    "keep_first",
    "keep_last",
    "remove_all",
]

# SQL configuration
SQL_ENGINE = "duckdb"
DEFAULT_QUERY_LIMIT = 1000

# API configuration
API_PREFIX = "/api"
