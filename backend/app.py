"""Read-only API for the CommerceIQ analytics dashboard."""
from pathlib import Path
import json
import os
import sqlite3
from typing import Annotated
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = Path(__file__).with_name("commerceiq.db")
PROFILE = ROOT / "analysis" / "dataset_profile.json"

app = FastAPI(title="CommerceIQ Analytics API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["GET"],
    allow_headers=["*"],
)

def connect():
    if not DB_PATH.exists():
        raise RuntimeError("Database missing. Run: python backend/build_database.py")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def rows(query, parameters=()):
    with connect() as conn:
        return [dict(row) for row in conn.execute(query, parameters).fetchall()]

@app.get("/api/health")
def health():
    return {"status": "ok", "database": DB_PATH.exists()}

@app.get("/api/quality")
def quality():
    return json.loads(PROFILE.read_text(encoding="utf-8"))

@app.get("/api/overview")
def overview(
    start: Annotated[str | None, Query(description="Inclusive YYYY-MM-DD")] = None,
    end: Annotated[str | None, Query(description="Inclusive YYYY-MM-DD")] = None,
    category: Annotated[str | None, Query(description="Product category; filters to orders containing the category")] = None,
    seller: Annotated[str | None, Query(description="Seller ID; filters to orders containing the seller")] = None,
    payment_type: Annotated[str | None, Query(description="Payment method; filters to orders containing the method")] = None,
    review_band: Annotated[str | None, Query(description="One of low, neutral, high")] = None,
    delivery_status: Annotated[str | None, Query(description="One of on_time, late")] = None,
):
    clauses, values = ["order_status = 'delivered'"], []
    if start:
        clauses.append("date(order_purchase_timestamp) >= date(?)"); values.append(start)
    if end:
        clauses.append("date(order_purchase_timestamp) <= date(?)"); values.append(end)
    if category:
        clauses.append("order_id IN (SELECT DISTINCT order_id FROM items WHERE product_category_name = ?)")
        values.append(category)
    if seller:
        clauses.append("order_id IN (SELECT DISTINCT order_id FROM items WHERE seller_id = ?)")
        values.append(seller)
    if payment_type:
        clauses.append("order_id IN (SELECT DISTINCT order_id FROM payments WHERE payment_type = ?)")
        values.append(payment_type)
    if review_band == "low":
        clauses.append("review_score <= 2")
    elif review_band == "neutral":
        clauses.append("review_score = 3")
    elif review_band == "high":
        clauses.append("review_score >= 4")
    if delivery_status == "on_time":
        clauses.append("delivery_days_early_late <= 0")
    elif delivery_status == "late":
        clauses.append("delivery_days_early_late > 0")
    where = " AND ".join(clauses)
    kpi = rows(f"""SELECT COUNT(DISTINCT order_id) orders, COUNT(DISTINCT customer_unique_id) unique_customers,
        ROUND(SUM(payment_value), 2) payment_revenue, ROUND(AVG(payment_value), 2) average_order_value,
        ROUND(AVG(review_score), 2) average_review_score, ROUND(AVG(delivery_days), 2) average_delivery_days,
        ROUND(100.0 * AVG(CASE WHEN delivery_days_early_late <= 0 THEN 1 ELSE 0 END), 2) on_or_before_estimated_delivery_pct
        FROM orders WHERE {where}""", values)[0]
    monthly = rows(f"""SELECT substr(order_purchase_timestamp, 1, 7) month, ROUND(SUM(payment_value), 2) revenue,
        COUNT(DISTINCT order_id) orders FROM orders WHERE {where} GROUP BY 1 ORDER BY 1""", values)
    return {"kpis": kpi, "monthly": monthly, "scope": {"start": start, "end": end, "category": category, "seller": seller, "payment_type": payment_type, "review_band": review_band, "delivery_status": delivery_status, "status": "delivered"}}

@app.get("/api/categories")
def categories(limit: Annotated[int, Query(ge=1, le=30)] = 10):
    return rows("""SELECT product_category_name category, ROUND(SUM(line_value), 2) revenue,
        COUNT(*) units, COUNT(DISTINCT order_id) orders, ROUND(AVG(review_score), 2) avg_rating
        FROM items GROUP BY 1 ORDER BY revenue DESC LIMIT ?""", (limit,))

@app.get("/api/sellers")
def sellers(limit: Annotated[int, Query(ge=1, le=30)] = 10):
    return rows("""SELECT seller_id, ROUND(SUM(line_value), 2) revenue, COUNT(DISTINCT order_id) orders,
        ROUND(AVG(review_score), 2) avg_rating FROM items GROUP BY 1 ORDER BY revenue DESC LIMIT ?""", (limit,))

@app.get("/api/order-details")
def order_details(category: str | None = None, seller: str | None = None, limit: Annotated[int, Query(ge=1, le=100)] = 25):
    clauses, values = ["1 = 1"], []
    if category:
        clauses.append("product_category_name = ?"); values.append(category)
    if seller:
        clauses.append("seller_id = ?"); values.append(seller)
    values.append(limit)
    return rows(f"""SELECT order_id, product_category_name category, seller_id, ROUND(line_value, 2) item_revenue,
        ROUND(review_score, 1) review_score, order_purchase_timestamp FROM items WHERE {' AND '.join(clauses)}
        ORDER BY order_purchase_timestamp DESC LIMIT ?""", values)
