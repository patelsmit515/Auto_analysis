# Contributing to Auto_analysis

Thank you for your interest in contributing to **Auto_analysis**! We welcome contributions that improve reliability, performance, user experience, and documentation.

---

## Getting Started

1. **Fork the Repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/<your-username>/Auto_analysis.git
   cd Auto_analysis
   ```
3. **Set up a Virtual Environment**:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   ```

---

## Development Workflow

1. Create a descriptive topic branch:
   ```bash
   git checkout -b feature/my-new-feature
   ```
2. Make your improvements. Ensure you maintain code quality and preserve existing comments.
3. Run the automated test suite to ensure everything passes:
   ```powershell
   .\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py"
   ```
4. Test in browser at `http://127.0.0.1:3000` with the backend running on `http://127.0.0.1:8000`.

---

## Submitting a Pull Request

1. Commit your changes with clear, semantic commit messages:
   ```bash
   git commit -m "feat: add support for parquet export"
   ```
2. Push to your fork:
   ```bash
   git push origin feature/my-new-feature
   ```
3. Open a Pull Request against the `main` branch on GitHub using the provided PR template.

---

## Code of Conduct

Please be respectful, constructive, and helpful when interacting with other contributors and users.
