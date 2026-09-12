# API Reference

The backend exposes a RESTful API built on FastAPI. All responses are JSON. Standard endpoints return HTTP 200 on success and HTTP 400/422/500 on errors.

## Authentication

Authentication is handled via JWT (mocked in the current iteration). The token should be passed in the `Authorization` header as a Bearer token.

### `POST /api/auth/login`
Authenticates a user and returns a token.
- **Payload**: `{"email": "user@example.com", "password": "password"}`
- **Response**: `{"access_token": "string", "token_type": "bearer", "role": "admin", "email": "string"}`

### `GET /api/auth/profile`
Returns the current authenticated user's profile and organization context.
- **Response**: `{"email": "string", "role": "string", "credits": 100, "org_name": "string"}`

## Organizations

### `GET /api/orgs`
Lists organizations the user belongs to.
- **Response**: `[{"id": 1, "name": "Lab A", "credits_balance": 10000, "created_at": "timestamp"}]`

### `POST /api/orgs`
Creates a new organization and assigns the user as admin.
- **Payload**: `{"name": "New Lab"}`

## Jobs & Compute

### `POST /api/jobs/submit`
Submits a new job to the distributed queue. Accepts `multipart/form-data` to handle file uploads.
- **Form Data**:
  - `cpu`: int
  - `ram`: int
  - `gpu`: boolean
  - `workspace_id`: string
  - `file`: UploadFile (optional)
  - `codeString`: string (optional)
- **Response**: `{"status": "success", "job_id": "job-1234abcd"}`

### `GET /api/jobs/status`
Returns the status of all jobs for a specific workspace.
- **Query Params**: `?workspace_id=string`
- **Response**: `[{"id": "job-123", "status": "queued", ...}]`

### `GET /api/jobs/logs/stream/{job_id}`
Server-Sent Events (SSE) endpoint that streams live stdout/stderr from the execution agent.
- **Response**: `text/event-stream`

## Deployments (MLOps)

### `POST /api/models/deploy`
Takes a completed job's output weights and provisions an inference container.
- **Payload**: `{"job_id": "string", "workspace_id": "string"}`
- **Response**: `{"status": "success", "endpoint": "https://..."}`

### `POST /api/jupyter/launch`
Provisions an interactive JupyterLab container for data exploration.
- **Payload**: `{"workspace_id": "string"}`
- **Response**: `{"status": "success", "url": "https://..."}`
