# Frontend — Contact Center HQ

React SPA for managing DynamoDB-backed contact center configuration tables.

---

## Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 |
| Bundler | Vite 8 |
| Styling | Tailwind CSS v4 |
| Language | JavaScript (JSX) |
| Package manager | npm |

---

## Folder Structure

```
frontend/
├── index.html                        # HTML entry point
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx                      # React root — mounts <App />
│   ├── App.jsx                       # Root component — composes Header + Main
│   ├── tableSchema.json              # Table definitions (title, fields, pk)
│   └── components/
│       ├── Header/
│       │   └── Header.jsx            # Top navigation bar
│       └── Main/
│           ├── Main.jsx              # Grid of table cards
│           └── TableCard/
│               ├── TableCard.jsx     # Clickable card per DynamoDB table
│               └── RecordModal/
│                   ├── RecordModal.jsx       # Modal wrapper
│                   ├── ModalHeader/
│                   │   └── ModalHeader.jsx   # Modal title + close button
│                   ├── RecordSearch/
│                   │   ├── RecordSearch.jsx          # Search input + trigger
│                   │   └── SearchResult/
│                   │       └── SearchResult.jsx      # List of search results
│                   └── RecordForm/
│                       ├── RecordForm.jsx            # Create / edit form
│                       └── FieldInput/
│                           ├── StringField.jsx       # Text input
│                           ├── IntegerField.jsx      # Number input
│                           ├── DropdownField.jsx     # Select input
│                           └── BooleanField.jsx      # Toggle / checkbox
```

---

## API calls

All API calls target the backend at `/api/v1/...`. In dev mode Vite proxies them to `http://localhost:8000` (configured in `vite.config.js`).

| Action | Method | URL |
|--------|--------|-----|
| Search records | GET | `/api/v1/records/{table}/search` |
| Fetch record | GET | `/api/v1/records/{table}/{id}` |
| Create record | POST | `/api/v1/records/{table}` |
| Update record | PUT | `/api/v1/records/{table}/{id}` |
| Delete record | DELETE | `/api/v1/records/{table}/{id}` |

---

## How to Run Locally

### Prerequisites

- Node.js 18+
- npm
- Backend running on `http://localhost:8000`

### Steps

```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Start dev server
npm run dev
```

App runs at `http://localhost:5173`
Hot module replacement is enabled — changes reflect instantly.

### Build for production

```bash
npm run build
```

Output goes to `frontend/dist/`. The FastAPI backend serves this folder automatically when it exists.

---

## Adding a New Table

Tables are driven by `src/tableSchema.json`. Add an entry there — no code changes needed.

```json
{
  "id": "my-table",
  "title": "My Table",
  "description": "Short description",
  "tableName": "MyDynamoDBTable",
  "pk": "MyPrimaryKeyField",
  "fields": [
    { "name": "MyPrimaryKeyField", "type": "string", "label": "ID" },
    { "name": "Status", "type": "dropdown", "label": "Status", "options": ["Active", "Inactive"] },
    { "name": "Enabled", "type": "boolean", "label": "Enabled" }
  ]
}
```

Supported field types: `string`, `integer`, `dropdown`, `boolean`.

---

## Adding a New Component

Follow the existing folder convention — one folder per component, named the same as the file:

```
components/
└── Main/
    └── MyFeature/
        └── MyFeature.jsx
```
