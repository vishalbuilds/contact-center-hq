# Backend — Contact Center HQ

FastAPI backend that serves a versioned REST API over AWS DynamoDB.

---

## Stack

| Layer | Technology |
|-------|------------|
| Runtime | Python 3.12+ |
| Framework | FastAPI |
| AWS SDK | boto3 |
| Data validation | Pydantic v2 |
| Server | Uvicorn |
| Package manager | uv |

---

## Folder Structure

```
backend/
├── main.py               # App entry point — registers routers, lifespan, static files
├── pyproject.toml        # Dependencies and project metadata
├── aws_api/              # DynamoDB resource API
│   └── v1/
│       ├── dynamodb.py   # DynamoDB helper class (get, put, update, delete, scan)
│       └── router.py     # APIRouter — all /records endpoints
└── auth/                 # Auth API (future)
    └── v1/
        └── auth.py       # Placeholder for auth router
```

---

## API Endpoints

Base URL: `http://localhost:8000`

### Health

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/health` | Check if the server is up |

### Records (v1)

All record endpoints require the `x-pk` header (the DynamoDB primary key field name).

| Method | URL | Headers | Description |
|--------|-----|---------|-------------|
| GET | `/api/v1/records/{table}/search` | `x-pk`, `x-pk-value` | Scan table for matching values |
| GET | `/api/v1/records/{table}/{id}` | `x-pk` | Fetch a single record |
| POST | `/api/v1/records/{table}` | `x-pk` | Create a new record |
| PUT | `/api/v1/records/{table}/{id}` | `x-pk` | Update an existing record |
| DELETE | `/api/v1/records/{table}/{id}` | `x-pk` | Delete a record |

#### Example — fetch a record

```
GET /api/v1/records/Contacts/abc-123
x-pk: ContactId
```

---

## How to Run Locally

### Prerequisites

- Python 3.12+
- [uv](https://github.com/astral-sh/uv) installed
- AWS credentials configured (`~/.aws/credentials` or env vars)

### Steps

```bash
# 1. Install dependencies
cd backend
uv sync

# 2. Set environment variables (optional — defaults to us-east-1)
$env:AWS_REGION = "us-east-1"
$env:AWS_ACCESS_KEY_ID = "your-key"
$env:AWS_SECRET_ACCESS_KEY = "your-secret"

# 3. Start the server
uv run uvicorn main:app --reload --port 8000
```

Server runs at `http://localhost:8000`
Interactive API docs at `http://localhost:8000/docs`

---

## Adding a New API Version (v1 → v2)

1. Create the new version folder:

```
aws_api/
└── v2/
    ├── __init__.py
    ├── dynamodb.py   # copy or extend from v1 if needed
    └── router.py     # new APIRouter with updated logic
```

2. Register it in `main.py` — one line:

```python
from backend.aws_api.v2.router import router as v2_router

app.include_router(v2_router, prefix="/api/v2")
```

That's it. `/api/v1/...` keeps working unchanged. Clients migrate to `/api/v2/...` on their own schedule.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_REGION` | `us-east-1` | AWS region for DynamoDB |
| `AWS_ACCESS_KEY_ID` | — | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | — | AWS secret key |
