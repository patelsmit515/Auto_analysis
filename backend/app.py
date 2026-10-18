
"""FastAPI endpoints for Auto_analysis."""

from io import BytesIO

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from src.config import PROJECT_NAME
from src.data_loader import load_csv, inspect_data
from src.validation import validate_data
from src.charts import prepare_chart


app = FastAPI(
    title=PROJECT_NAME,
    description="A data cleaning and SQL analysis application.",
    version="1.0.0",
)


@app.get("/")
def home():
    return {
        "project": PROJECT_NAME,
        "status": "running",
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}


@app.post("/api/inspect-csv")
async def inspect_csv(file: UploadFile = File(...)):
    """Upload a CSV and return its inspection results."""

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a CSV file.",
        )

    try:
        contents = await file.read()
        df = load_csv(BytesIO(contents))

        information = inspect_data(df)
        validation = validate_data(df)

        return {
            "filename": file.filename,
            "information": information,
            "validation": validation,
        }

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read the CSV file: {error}",
        ) from error


@app.post("/api/create-chart")
async def create_chart(
    file: UploadFile = File(...),
    chart_type: str = Form(...),
    x_column: str = Form(...),
    y_column: str | None = Form(default=None),
):
    """Prepare chart data based on the user's selections."""

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a CSV file.",
        )

    try:
        contents = await file.read()
        df = load_csv(BytesIO(contents))

        chart = prepare_chart(
            df=df,
            chart_type=chart_type,
            x_column=x_column,
            y_column=y_column or None,
        )

        return {
            "filename": file.filename,
            "chart": chart,
        }

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Could not create chart: {error}",
        ) from error
