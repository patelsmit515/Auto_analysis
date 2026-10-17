
from backend.app import app

print("\n--- Application ---")
print(app.title)

print("\n--- Available Routes ---")
for route in app.routes:
    if hasattr(route, "methods"):
        print(route.methods, route.path)
