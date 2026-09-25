# E-Commerce Tableau Case Study

**E-Commerce Business Performance, Customer Behavior and Seller Analytics Using Tableau**

This repository contains a reproducible analysis of a public e-commerce marketplace dataset, Tableau-ready extracts, and complete CA3 project material.

> Accuracy note: source city, state, ZIP-prefix, and coordinate fields are not authenticated real-world geography. Treat them as source-defined labels only; do not present this dataset as Indian or make country-level geographic claims.

## Repository structure

```text
archive/                         Raw CSV source tables
archive.zip                      Original downloaded archive
analysis/profile_dataset.py      Reproducible data-profile and extract script
analysis/dataset_profile.json    Validated KPI and data-quality output
analysis/tableau_ready/          CSVs prepared at safe analytical grains
CA3_TABLEAU_PROJECT_GUIDE.md     Dashboard plan, findings, methodology, slides, viva Q&A
backend/                         FastAPI API, SQLite database builder, and regression tests
frontend/                        React/Vite analytics dashboard
.github/workflows/ci.yml         Data, API, lint, and production-build CI checks
render.yaml                      Render deployment configuration for the API
```

## Requirements

- Python 3.10 or newer
- `pandas`
- Tableau Desktop or Tableau Public (for workbook creation)

Install the Python dependency:

```powershell
python -m pip install pandas
```

## Run the analysis

From the repository root:

```powershell
python analysis/profile_dataset.py
```

The script does not change the raw files in `archive/`. It validates the source data and regenerates:

- `analysis/dataset_profile.json` — KPI baseline, quality checks, and evidence-backed findings
- `analysis/tableau_ready/Order_Summary.csv` — one row per order
- `analysis/tableau_ready/Item_Detail.csv` — one row per delivered order item
- `analysis/tableau_ready/Payments.csv` — one row per payment component
- `analysis/tableau_ready/Payment_Order_Summary.csv` — payment data aggregated to one row per order
- `analysis/tableau_ready/Review_Order_Summary.csv` — review data aggregated to one row per order
- `analysis/tableau_ready/Category_Pairs.csv` — distinct product-category co-purchase pairs

## Build the Tableau workbook

1. Open Tableau and connect to the CSV files in `analysis/tableau_ready/`.
2. Use `Order_Summary.csv` for headline KPIs, sales trends, customer behavior, and delivery performance.
3. Use `Item_Detail.csv` for product, category, and seller analysis. Count orders with `COUNTD([order_id])`.
4. Use `Payments.csv` only for payment-method analysis and `Category_Pairs.csv` for cross-sell analysis.
5. Do not physically join `Item_Detail.csv` to `Payments.csv` or raw review records: this creates many-to-many fan-out and inflates values.
6. Follow the data model, calculated-field definitions, dashboard wireframe, insight wording, methodology, presentation outline, and viva questions in [CA3_TABLEAU_PROJECT_GUIDE.md](CA3_TABLEAU_PROJECT_GUIDE.md).

## Run the web dashboard

The `frontend/` directory contains a responsive React + Vite analytics dashboard. It displays validated KPI cards, monthly performance, payment mix, category performance, delivery experience, cross-sell opportunities, seller scorecards, data-integrity checks, and an item-level drill-down table.

### Dashboard capabilities

- API-backed filters for date range, category, seller, payment method, review band, and delivery punctuality.
- Filter state saved in the URL so a copied link reopens the same view.
- CSV export of the currently filtered monthly trend.
- Static validated-data fallback when the API is unavailable, plus a retryable error state when required dashboard data cannot load.
- Clear distinction between payment revenue (order level) and item revenue (product/seller level).
- Source-defined location disclaimer; no real-world geographic claims.

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). To create a production build, run:

```powershell
npm run build
```

The dashboard reads `frontend/public/dashboard-data.json`. Regenerate it along with the analytical extracts by returning to the repository root and running `python analysis/profile_dataset.py`.

## Run the API and analytical database

The FastAPI service provides production-style, read-only endpoints for health checks, quality metadata, filtered KPIs/trends, categories, sellers, and item drill-down. Build the SQLite database after regenerating extracts:

```powershell
python backend/build_database.py
uvicorn backend.app:app --reload
```

The API is then available at `http://127.0.0.1:8000`, with interactive OpenAPI documentation at `/docs`. Start the frontend in another terminal; Vite proxies `/api` requests to this local service. For a separate deployed API, set `VITE_API_BASE_URL` to its public origin.

Available API endpoints: `/api/health`, `/api/quality`, `/api/overview`, `/api/categories`, `/api/sellers`, and `/api/order-details`.

## Verification and continuous integration

```powershell
python -m unittest backend/test_api.py
cd frontend
npm run lint
npm run build
```

GitHub Actions repeats the extract generation, database build, API regression checks, linting, and production build for pushes and pull requests. The database itself is intentionally ignored because it is reproducibly built from versioned extracts.

## Deployment

1. Deploy the repository root to Render using `render.yaml`; it provisions the API, regenerates the extracts/database, and exposes `/api/health`.
2. In Render, set `CORS_ORIGINS` to the deployed Vercel URL (for example, `https://your-project.vercel.app`). This authorizes browser API requests only from that frontend.
3. Deploy `frontend/` to Vercel. Set the build command to `npm run build`, the output directory to `dist`, and environment variable `VITE_API_BASE_URL` to the Render API origin (for example, `https://commerceiq-api.onrender.com`).
4. Verify `/api/health`, `/docs`, the deployed dashboard, filters, CSV export, and the location-disclaimer text before sharing the URL.

## Validated baseline (delivered orders)

| Metric | Value |
|---|---:|
| Completed orders | 96,478 |
| Unique customers | 93,358 |
| Payment revenue | 15,422,461.77 |
| Average order value | 159.86 |
| Average review score | 4.14 / 5 |
| Average delivery time | 12.56 days |
| On/before estimated delivery | 91.88% |

## Reproducibility and limitations

The raw inputs remain preserved under `archive/`; all calculations are regenerated by the profiling script. Dashboard figures should be validated against `analysis/dataset_profile.json`. Findings are descriptive and should not be presented as causal evidence.
