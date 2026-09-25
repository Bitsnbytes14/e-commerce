import unittest
from fastapi.testclient import TestClient
from backend.app import app

client = TestClient(app)

class ApiTests(unittest.TestCase):
    def test_health(self):
        self.assertEqual(client.get("/api/health").json()["status"], "ok")

    def test_overview_has_valid_kpis(self):
        result = client.get("/api/overview")
        self.assertEqual(result.status_code, 200)
        body = result.json()
        self.assertEqual(body["kpis"]["orders"], 96478)
        self.assertEqual(body["kpis"]["payment_revenue"], 15422461.77)
        self.assertGreater(len(body["monthly"]), 20)

    def test_category_endpoint_returns_ranked_data(self):
        body = client.get("/api/categories?limit=3").json()
        self.assertEqual(len(body), 3)
        self.assertGreaterEqual(body[0]["revenue"], body[1]["revenue"])

    def test_date_filter_changes_overview_scope(self):
        body = client.get("/api/overview?start=2017-01-01&end=2017-01-31").json()
        self.assertEqual(body["scope"]["start"], "2017-01-01")
        self.assertEqual(body["scope"]["end"], "2017-01-31")
        self.assertLess(body["kpis"]["orders"], 96478)

    def test_category_filter_restricts_to_matching_orders(self):
        body = client.get("/api/overview?category=Health_Beauty").json()
        self.assertEqual(body["scope"]["category"], "Health_Beauty")
        self.assertLess(body["kpis"]["orders"], 96478)

    def test_seller_filter_restricts_to_matching_orders(self):
        seller_id = "4869f7a5dfa277a7dca6462dcf3b52b2"
        body = client.get(f"/api/overview?seller={seller_id}").json()
        self.assertEqual(body["scope"]["seller"], seller_id)
        self.assertLess(body["kpis"]["orders"], 96478)

    def test_payment_rating_and_delivery_filters(self):
        body = client.get("/api/overview?payment_type=credit_card&review_band=high&delivery_status=on_time").json()
        self.assertEqual(body["scope"]["payment_type"], "credit_card")
        self.assertEqual(body["scope"]["review_band"], "high")
        self.assertEqual(body["scope"]["delivery_status"], "on_time")
        self.assertGreater(body["kpis"]["orders"], 0)

    def test_order_drill_down_returns_limited_records(self):
        body = client.get("/api/order-details?category=Health_Beauty&limit=5").json()
        self.assertEqual(len(body), 5)
        self.assertTrue(all(row["category"] == "Health_Beauty" for row in body))

if __name__ == "__main__":
    unittest.main()
