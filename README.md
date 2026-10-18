# Auto_analysis

A reliable, clean, beginner-friendly local data analysis and SQL workspace application built with **FastAPI**, **DuckDB**, **Pandas**, and **Vanilla HTML/CSS/JavaScript**.

Its purpose is to make routine data cleaning, cell editing, dataset management, relational integrity verification, and SQL analysis fast and intuitive without repeatedly writing Python code or SQL queries manually.

---

## Key Features & Capabilities

1. **Local-First & Offline Privacy**:
   - 100% local processing; all data stays on your machine (`127.0.0.1`).
   - No internet connection required after dependencies are installed.
   - Zero telemetry, analytics, cloud processing, or external API calls.
   - Strict DuckDB security guardrails disabling arbitrary filesystem access, `httpfs`, or network operations.

2. **Excel-Like In-Place Cell Editing**:
   - Double-click any table cell in the data inspector to edit values directly.
   - Type validation for numeric and datetime fields; supports setting cells to empty/null.
   - Press **Enter** to save, **Esc** to cancel.
   - Instant row search filter by student ID, name, city, or any column value.
   - Edits apply to a working copy, preserving original uploaded files.
   - Single-click **Undo Last Change** restores previous values and column states.

3. **Multi-Column Duplicate Detection**:
   - Check all columns or select specific column subsets (e.g., detect duplicates when `Full_Name`, `Age`, and `City` match, even if `Student_ID` differs like S004 and S009).
   - "Select all" and "Select none" column controls.
   - Highlight duplicate rows with total counts before applying.
   - Choose which rows to retain: Keep First, Keep Last, or Remove All.
   - Confirmation dialog prevents accidental row deletion.

4. **Date & Time Conversion**:
   - Convert string date columns into structured datetimes.
   - Automatically infer formats (ISO dates, timestamps, mixed formats) or specify custom format strings.
   - Choose how to handle invalid or malformed dates (e.g. `invalid-date`):
     - `coerce` (Recommended): Safely converts invalid values to null/missing without crashing, preserving valid time components (`%H:%M:%S`).
     - `raise`: Halts with a clear, safe explanation listing the exact invalid sample values without modifying the working dataset.
   - Real-time conversion preview with statistics: Total rows, successfully converted, invalid values, and missing values.

5. **Safe Data Transformations**:
   - Working copy vs new dataset: transformations preserve original uploaded data by default.
   - Missing-value imputation with "Select all" and "Select none" column checkboxes.
   - Multi-separator text splitting: split values like `Python;SQL,Excel` using multiple delimiters (`[;,]` or `;` and `,`) in a single step, with clear Max-Splits guidance.
   - Cancel / Discard unconfirmed previews safely without affecting working data.

6. **Dataset Manager & Session Cleanup**:
   - Real-time session dataset manager on the Dashboard.
   - **Remove from Session**: Clears the dataset from active memory and in-memory DuckDB registration, keeping any saved disk files untouched.
   - **Clear Session**: Removes all datasets and drops all DuckDB registered tables across the workspace.
   - **Saved Files on Disk**: Manage files in `data/exports/` separately. Inspect, load into the active session, or permanently delete with strict path-traversal protection.
   - Clear distinction between **Original** uploaded files and **Working Copy** datasets.
   - Tables and columns automatically refresh across the SQL schema, autocomplete, and all dropdowns.
   - Sessions start clean (no sample datasets auto-loaded on startup).

7. **Primary Key & Foreign Key Studio**:
   - **Automated Primary Key Evaluation**: Automatically evaluates every column for non-nullness and 100% uniqueness. Identifies eligible candidate keys, flags ineligible columns with exact failure reasons (e.g. missing values or duplicate counts), and discovers composite candidate pairs.
   - Includes real-world domain guidance: mathematical uniqueness does not guarantee entity identity.
   - **Foreign Key Check**: Validates child references against parent tables, highlighting unmatched orphan values (such as `C99`) with clear column tags.

8. **DuckDB SQL Workspace & Reference**:
   - Fast analytical SQL engine with DuckDB.
   - Clean session schema panel: shows table names, columns, and data types with 1-click text insertion.
   - Comfortable, tall SQL editor with autocomplete.
   - **Keyboard controls**: **Tab** accepts suggestions, **Enter** inserts a new line, **Arrows** navigate options, **Esc** dismisses.
   - Searchable SQL Reference covering 15 categories (Syntax, Filtering, Sorting, Aggregations, Grouping, Joins, Conditionals, Nulls, Text, Numeric, Dates, CTEs, Subqueries, Windows, Sets) with examples.

9. **Dark Mode / Light Mode**:
   - Full theme switcher with custom dark-mode token palette.
   - Persists user preference across browser reloads via `localStorage`.
   - Switching themes never resets dataset state or discards in-progress edits.

---

## Windows PowerShell Setup Instructions

### 1. Prerequisites
- Python 3.10, 3.11, 3.12, 3.13, or 3.14 on Windows.
- Open PowerShell in the project directory (`Auto_analysis`).

### 2. Virtual Environment Setup
If you haven't created a virtual environment yet:
```powershell
python -m venv .venv
```

#### If PowerShell Script Execution Policy Blocks Activation:
If running `.\.venv\Scripts\Activate.ps1` gives an execution policy error, you have two options:

- **Option A (Bypass policy for current terminal)**:
  ```powershell
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  .\.venv\Scripts\Activate.ps1
  ```

- **Option B (Direct execution without activation - Recommended)**:
  Use the virtual environment Python binary directly:
  ```powershell
  .\.venv\Scripts\python.exe -m pip install -r requirements.txt
  ```

### 3. Install Dependencies
```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

---

## Running the Application

You need two local services running (Backend API on port 8000, and Frontend on port 3000).

### Step 1: Start the Backend (Terminal 1)
In your first PowerShell window:
```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```
- The backend will start on: `http://127.0.0.1:8000`
- Swagger API documentation: `http://127.0.0.1:8000/docs`

### Step 2: Start the Frontend (Terminal 2)
In a second PowerShell window:
```powershell
.\.venv\Scripts\python.exe -m http.server 3000 --directory frontend --bind 127.0.0.1
```
- The frontend will be served at: `http://127.0.0.1:3000`

### Step 3: Open in Browser
Open Google Chrome, Microsoft Edge, or Firefox and go to:
```
http://127.0.0.1:3000
```
*(Alternatively, you can also access the app directly via FastAPI at `http://127.0.0.1:8000/app/`)*

### How to Stop the Application
To stop either server, switch to its terminal window and press:
```
Ctrl + C
```

---

## Session Persistence Behavior

- **Local & In-Memory**: Data transformations, working copies, and DuckDB table registrations are held in memory during the active server session.
- **Restarting the Backend**: When the backend server is stopped or restarted, in-memory datasets reset cleanly. Your original CSV files stored in `data/` or your computer are never altered.

---

## Running Automated Tests

To run all automated backend and integration tests:
```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py"
```

To run focused API and end-to-end tests:
```powershell
.\.venv\Scripts\python.exe -m unittest tests/test_api_improvements.py
```

---

## Step-by-Step Manual Retest Checklist

Follow this checklist in your browser (`http://127.0.0.1:3000`) to test the new features:

1. **Clean Initial State & Test Data Loading**:
   - Open `http://127.0.0.1:3000`. Notice that no datasets are pre-loaded (session starts clean).
   - Go to **Relationships** or **Import & Inspect** and click **+ Load Test Datasets** (loads `test_workflow.csv` and `test_courses.csv`).
2. **Theme Switching (Dark / Light Mode)**:
   - Click the theme toggle icon in the top header.
   - Verify all panels, tables, and dropdowns transition smoothly to Dark Mode.
   - Refresh the browser page (`F5`); verify Dark Mode is remembered.
3. **Excel-Like Cell Editing & Row Search**:
   - Go to **Import & Inspect**.
   - Type `S004` into the **Search rows** box and click **Search**. Verify only row S004 is displayed. Click **Clear** to reset.
   - Double-click on any cell in the `Score` column. Edit the number (e.g. change `85` to `99`).
   - Press **Enter** or click **Save**. Notice the cell updates and the blue **Undo** button activates.
   - Click **Undo**; verify the cell reverts to its previous value.
4. **Duplicate Detection with Selected Columns**:
   - Go to **Clean & Transform** &rarr; **Duplicate Rows**.
   - Notice that checking all columns shows 0 duplicates (because `Student_ID` S004 &ne; S009).
   - Uncheck `Student_ID` or click **Select None** and check only `Full_Name`, `Age`, and `City`.
   - Click **Check & Highlight Duplicate Rows**.
   - Verify that 1 duplicate row is found (`S009` matching `S004`) and displayed in the preview table.
   - Select **Keep First (preserve earliest row)** and click **Remove Duplicates**. Confirm the prompt.
5. **Multi-Separator Splitting**:
   - In **Clean & Transform** &rarr; **Split Text Columns**, select column `Skills`.
   - In the Separator field, enter `;,` or select **Regex Pattern** and enter `[;,]`.
   - Enter New Column Names: `Skill1, Skill2, Skill3`.
   - Click **Preview Result**. Verify the columns split correctly without losing data.
6. **Primary Key Automated Evaluation**:
   - Go to **Relationships**.
   - Select `test_workflow`. Notice the automated check marks `Student_ID` as **Eligible** (green), while `Full_Name`, `City`, and `Score` are flagged as **Ineligible** with reasons (e.g. duplicate or missing counts).
7. **Foreign Key Mismatch Verification**:
   - In **Foreign Key Reference Check**, select Parent `test_courses` (`Course_ID`) and Child `test_workflow` (`Course_ID`).
   - Click **Validate Foreign Key Reference**.
   - Verify the unmatched key `C99` is flagged with parent and child tags.
8. **SQL Workspace & Autocomplete**:
   - Go to **SQL Analysis**.
   - In the SQL editor, start typing `SELECT s.` and verify the autocomplete popup appears with qualified column names (`s.Full_Name`, `s.Score`).
   - Press **ArrowDown** to select, then press **Tab** to insert the suggestion.
   - Press **Enter** and verify that it creates a new line in the query instead of replacing text.
   - Browse the **SQL Reference** category dropdown (e.g. select **Joins** or **Date & Time**) to view syntax and practical examples.
9. **Dataset Manager & Clean Removal**:
   - Go to **Dashboard**. In the **Session Dataset Manager** table, click **Rename** on a dataset and enter a new name.
   - Verify that DuckDB schema updates immediately in the SQL view.
   - Click **Remove** on a dataset. Confirm the dialog. Verify that querying that table in SQL now correctly states that the table does not exist.
