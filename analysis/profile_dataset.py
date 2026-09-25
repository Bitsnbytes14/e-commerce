"""Profile the supplied marketplace CSVs without altering the raw download.

Run from the project root:
    python analysis/profile_dataset.py
"""

from __future__ import annotations

import itertools
import json
from pathlib import Path

import pandas as pd


SOURCE = Path("archive")
OUTPUT = Path("analysis")


def read(name: str, **kwargs) -> pd.DataFrame:
    return pd.read_csv(SOURCE / f"{name}.csv", **kwargs)


def money(value: float) -> float:
    return round(float(value), 2)


customers = read("CUSTOMERS")
orders = read("ORDERS")
items = read("ORDER_ITEMS")
payments = read("ORDER_PAYMENTS")
reviews = read("ORDER_REVIEW_RATINGS")
products = read("PRODUCTS")
sellers = read("SELLERS")
geo = read("GEO_LOCATION")

for column in [
    "order_purchase_timestamp",
    "order_approved_at",
    "order_delivered_carrier_date",
    "order_delivered_customer_date",
    "order_estimated_delivery_date",
]:
    orders[column] = pd.to_datetime(orders[column], format="%m/%d/%Y %H:%M", errors="coerce")

reviews["review_creation_date"] = pd.to_datetime(
    reviews["review_creation_date"], format="%m/%d/%Y %H:%M", errors="coerce"
)

# These summaries are deliberately separate from the raw detail tables.  Joining
# raw items, payments, and reviews together would multiply values per order.
payment_by_order = payments.groupby("order_id", as_index=False).agg(
    payment_value=("payment_value", "sum"),
    payment_rows=("payment_sequential", "size"),
    max_installments=("payment_installments", "max"),
)
review_by_order = reviews.groupby("order_id", as_index=False).agg(
    review_score=("review_score", "mean"), review_rows=("review_id", "size")
)
item_by_order = items.groupby("order_id", as_index=False).agg(
    item_count=("order_item_id", "size"),
    merchandise_value=("price", "sum"),
    freight_value=("freight_value", "sum"),
)

order_fact = (
    orders.merge(customers, on="customer_id", how="left", validate="one_to_one")
    .merge(payment_by_order, on="order_id", how="left", validate="one_to_one")
    .merge(review_by_order, on="order_id", how="left", validate="one_to_one")
    .merge(item_by_order, on="order_id", how="left", validate="one_to_one")
)
order_fact["order_total_from_items"] = (
    order_fact["merchandise_value"].fillna(0) + order_fact["freight_value"].fillna(0)
)
order_fact["delivery_days"] = (
    order_fact["order_delivered_customer_date"] - order_fact["order_purchase_timestamp"]
).dt.total_seconds() / 86400
order_fact["estimated_delivery_days"] = (
    order_fact["order_estimated_delivery_date"] - order_fact["order_purchase_timestamp"]
).dt.total_seconds() / 86400
order_fact["delivery_days_early_late"] = (
    order_fact["order_delivered_customer_date"] - order_fact["order_estimated_delivery_date"]
).dt.total_seconds() / 86400

delivered = order_fact.query("order_status == 'delivered'").copy()
delivered["purchase_month"] = delivered["order_purchase_timestamp"].dt.to_period("M").astype(str)

customer_summary = delivered.groupby("customer_unique_id", as_index=False).agg(
    delivered_orders=("order_id", "nunique"),
    revenue=("payment_value", "sum"),
    first_purchase=("order_purchase_timestamp", "min"),
    last_purchase=("order_purchase_timestamp", "max"),
    avg_rating=("review_score", "mean"),
)

item_detail = (
    items.merge(products[["product_id", "product_category_name"]], on="product_id", how="left")
    .merge(sellers[["seller_id", "seller_city", "seller_state"]], on="seller_id", how="left")
    .merge(
        delivered[["order_id", "customer_unique_id", "customer_state", "customer_city", "review_score"]],
        on="order_id",
        how="inner",
    )
)
item_detail["product_category_name"] = item_detail["product_category_name"].fillna("Unclassified")
item_detail["line_value"] = item_detail["price"] + item_detail["freight_value"]

category = item_detail.groupby("product_category_name", as_index=False).agg(
    revenue=("line_value", "sum"),
    units=("order_item_id", "size"),
    orders=("order_id", "nunique"),
    avg_rating=("review_score", "mean"),
)
seller = item_detail.groupby("seller_id", as_index=False).agg(
    revenue=("line_value", "sum"),
    units=("order_item_id", "size"),
    orders=("order_id", "nunique"),
    avg_rating=("review_score", "mean"),
).merge(sellers, on="seller_id", how="left")

# A pair is counted once per order even when a product has multiple line rows.
pair_counts: dict[tuple[str, str], int] = {}
for _, group in item_detail.groupby("order_id"):
    values = sorted(set(group["product_category_name"]))
    for pair in itertools.combinations(values, 2):
        pair_counts[pair] = pair_counts.get(pair, 0) + 1
top_pairs = sorted(pair_counts.items(), key=lambda entry: (-entry[1], entry[0]))[:10]
category_pairs = pd.DataFrame(
    [
        {"category_1": pair[0], "category_2": pair[1], "orders_together": count}
        for pair, count in pair_counts.items()
    ]
).sort_values(["orders_together", "category_1", "category_2"], ascending=[False, True, True])

monthly = delivered.groupby("purchase_month", as_index=False).agg(
    orders=("order_id", "nunique"), revenue=("payment_value", "sum"), customers=("customer_unique_id", "nunique"),
)

state = delivered.groupby("customer_state", as_index=False).agg(
    orders=("order_id", "nunique"), revenue=("payment_value", "sum"), customers=("customer_unique_id", "nunique"),
    avg_rating=("review_score", "mean"),
)

checks = {
    "source_rows": {name: int(len(frame)) for name, frame in {
        "customers": customers, "orders": orders, "order_items": items, "order_payments": payments,
        "order_review_ratings": reviews, "products": products, "sellers": sellers, "geo_location": geo,
    }.items()},
    "date_coverage": {
        "first_purchase": str(orders["order_purchase_timestamp"].min()),
        "last_purchase": str(orders["order_purchase_timestamp"].max()),
    },
    "business_kpis_delivered_orders": {
        "orders": int(len(delivered)),
        "unique_customers": int(delivered["customer_unique_id"].nunique()),
        "payment_revenue": money(delivered["payment_value"].sum()),
        "average_order_value": money(delivered["payment_value"].mean()),
        "items": int(delivered["item_count"].sum()),
        "average_review_score": round(float(delivered["review_score"].mean()), 2),
        "average_delivery_days": round(float(delivered["delivery_days"].mean()), 2),
        "on_or_before_estimated_delivery_pct": round(float((delivered["delivery_days_early_late"] <= 0).mean() * 100), 2),
    },
    "order_statuses": {str(k): int(v) for k, v in orders["order_status"].value_counts().items()},
    "data_quality": {
        "orders_without_items": int((~orders["order_id"].isin(items["order_id"])).sum()),
        "orders_without_payment": int((~orders["order_id"].isin(payments["order_id"])).sum()),
        "duplicate_review_order_rows": int(reviews["order_id"].duplicated().sum()),
        "duplicate_payment_order_rows": int(payments["order_id"].duplicated().sum()),
        "uncategorized_products": int(products["product_category_name"].isna().sum()),
        "sellers_without_location": int(sellers["seller_city"].isna().sum()),
        "missing_delivered_timestamp": int(orders["order_delivered_customer_date"].isna().sum()),
    },
    "customer_behavior": {
        "customers_with_delivered_order": int(len(customer_summary)),
        "repeat_customers": int((customer_summary["delivered_orders"] >= 2).sum()),
        "repeat_customer_rate_pct": round(float((customer_summary["delivered_orders"] >= 2).mean() * 100), 2),
    },
    "top_months_by_revenue": [
        {"month": row.purchase_month, "revenue": money(row.revenue), "orders": int(row.orders)}
        for row in monthly.nlargest(5, "revenue").itertuples(index=False)
    ],
    "top_categories_by_revenue": [
        {"category": row.product_category_name, "revenue": money(row.revenue), "units": int(row.units), "avg_rating": round(float(row.avg_rating), 2)}
        for row in category.nlargest(10, "revenue").itertuples(index=False)
    ],
    "top_sellers_by_revenue": [
        {"seller_id": row.seller_id, "revenue": money(row.revenue), "orders": int(row.orders), "avg_rating": round(float(row.avg_rating), 2)}
        for row in seller.nlargest(10, "revenue").itertuples(index=False)
    ],
    "top_customer_states_by_revenue": [
        {"state": row.customer_state, "revenue": money(row.revenue), "orders": int(row.orders), "avg_rating": round(float(row.avg_rating), 2)}
        for row in state.nlargest(10, "revenue").itertuples(index=False)
    ],
    "payment_revenue_by_type": [
        {"payment_type": row.payment_type, "revenue": money(row.payment_value), "share_pct": round(float(row.payment_value / payments["payment_value"].sum() * 100), 2)}
        for row in payments.groupby("payment_type", as_index=False)["payment_value"].sum().sort_values("payment_value", ascending=False).itertuples(index=False)
    ],
    "top_category_pairs": [
        {"category_1": pair[0], "category_2": pair[1], "orders": count}
        for pair, count in top_pairs
    ],
}

OUTPUT.mkdir(exist_ok=True)
(OUTPUT / "tableau_ready").mkdir(exist_ok=True)

# Tableau-ready extracts.  Order_Summary is intentionally one row per order;
# Item_Detail is one row per item; payment data remains in its own table for
# payment-type analysis.  Do not join Item_Detail and Payments physically.
order_fact.to_csv(OUTPUT / "tableau_ready" / "Order_Summary.csv", index=False)
item_detail.to_csv(OUTPUT / "tableau_ready" / "Item_Detail.csv", index=False)
payments.to_csv(OUTPUT / "tableau_ready" / "Payments.csv", index=False)
category_pairs.to_csv(OUTPUT / "tableau_ready" / "Category_Pairs.csv", index=False)
payment_by_order.to_csv(OUTPUT / "tableau_ready" / "Payment_Order_Summary.csv", index=False)
review_by_order.to_csv(OUTPUT / "tableau_ready" / "Review_Order_Summary.csv", index=False)
(OUTPUT / "dataset_profile.json").write_text(json.dumps(checks, indent=2), encoding="utf-8")
print(json.dumps(checks, indent=2))
