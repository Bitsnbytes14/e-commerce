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

if __name__ == "__main__":
    unittest.main()
