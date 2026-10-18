# Auto_analysis — Frontend

Clean, modern, beginner-friendly local data analysis dashboard for **Auto_analysis**.

## Overview
This frontend connects directly to the local Python FastAPI backend (`http://127.0.0.1:8000`) and provides an intuitive, responsive interface for:
- **Dashboard**: Dataset health metrics, missing values, duplicates, and column summary.
- **Import and Inspect Data**: Upload CSV files, view live previews, data types, and validation warnings.
- **Clean and Transform**: 8 transformation tools (missing values, duplicates, column renaming, type conversion, column dropping, row filtering, text splitting, column combining, and datetime operations) with before/after previews.
- **SQL Analysis**: Interactive SQL query runner with context-aware autocomplete suggestions, schema explorer, syntax reference search, and query templates.
- **Charts**: Interactive rendering for bar, line, scatter, histogram, pie, and box charts using local Chart.js and SVG box-plot visualizers.
- **Relationships**: Primary key integrity validation and foreign key reference checking with unmatched value badges.
- **Export Data**: Download cleaned datasets as CSV files with customizable filenames and index settings.

## Running the Application

### 1. Start the Backend
From the project root:
```powershell
python -m uvicorn backend.app:app --reload --host 127.0.0.1 --port 8000
```
Backend API docs will be at `http://127.0.0.1:8000/docs`.

### 2. Open the Frontend

Option A: Directly from FastAPI (no extra server needed)
Open your browser to:
```
http://127.0.0.1:8000/app/
```

Option B: Dedicated local web server on port 3000
From the project root:
```powershell
python -m http.server 3000 --directory frontend --bind 127.0.0.1
```
Then navigate to:
```
http://127.0.0.1:3000
```

## Structure
- `index.html`: Main single-page application structure.
- `css/`: Design system and component styling (Vanilla CSS).
- `js/`: Modular JavaScript logic:
  - `api.js`: Communicates with FastAPI backend.
  - `state.js`: Global reactive application state.
  - `components/`: Table paginator, boxplot renderer, toast notifications.
  - `views/`: Dedicated view controllers for each section.
- `vendor/`: Local offline libraries (`chart.umd.min.js`).
