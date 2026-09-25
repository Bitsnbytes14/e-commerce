"""Create the SQLite analytical database from reproducible CSV extracts."""
from pathlib import Path
import sqlite3
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
EXTRACTS = ROOT / "analysis" / "tableau_ready"
DATABASE = Path(__file__).with_name("commerceiq.db")

with sqlite3.connect(DATABASE) as conn:
    for file_name, table_name in {
        "Order_Summary.csv": "orders",
        "Item_Detail.csv": "items",
        "Payments.csv": "payments",
        "Category_Pairs.csv": "category_pairs",
    }.items():
        pd.read_csv(EXTRACTS / file_name).to_sql(table_name, conn, if_exists="replace", index=False)
    conn.executescript("""
        CREATE INDEX IF NOT EXISTS idx_orders_purchase ON orders(order_purchase_timestamp);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
        CREATE INDEX IF NOT EXISTS idx_items_category ON items(product_category_name);
        CREATE INDEX IF NOT EXISTS idx_items_purchase ON items(order_purchase_timestamp);
    """)
print(f"Created {DATABASE}")
