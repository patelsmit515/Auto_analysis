
"""Tests for loading and inspecting CSV data."""

from src.data_loader import load_csv, inspect_data


def test_load_csv():
    df = load_csv("data/sample_students.csv")

    assert df.shape == (5, 4)
    assert list(df.columns) == ["Name", "Age", "City", "Score"]


def test_inspect_data():
    df = load_csv("data/sample_students.csv")
    info = inspect_data(df)

    assert info["rows"] == 5
    assert info["columns"] == 4
    assert info["missing_values"] == 2
    assert info["duplicate_rows"] == 1


def test_column_missing_values():
    df = load_csv("data/sample_students.csv")
    info = inspect_data(df)

    assert info["missing_by_column"]["Age"] == 1
    assert info["missing_by_column"]["City"] == 1


def test_preview():
    df = load_csv("data/sample_students.csv")
    info = inspect_data(df)

    assert len(info["preview"]) == 5
    assert info["preview"][0]["Name"] == "Asha"
