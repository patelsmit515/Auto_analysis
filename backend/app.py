
from io import BytesIO

from fastapi import FastAPI, File, HTTPException, UploadFile

from src.config import PROJECT_NAME
from src.data_loader import load_csv, inspect_data
from src.validation import validate_data

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
