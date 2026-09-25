# E-Commerce Business Performance, Customer Behavior and Seller Analytics Using Tableau

## Scope and data-accuracy note

This case study analyses a **public e-commerce marketplace dataset** supplied in the project folder. It covers 4 September 2016 through 17 October 2018. Although some source location labels and payment labels may resemble real-world terms, this is not authenticated national geography. Treat city, state, ZIP-prefix, latitude, and longitude fields as **source-defined labels only**. Do not call the dataset Indian, do not label any map as a real country, and do not make country-level claims.

## Dataset description

| Table | Rows | Business role | Key |
|---|---:|---|---|
| CUSTOMERS | 99,441 | Customer/order address snapshot | customer_id; customer_unique_id |
| ORDERS | 99,441 | Order lifecycle and timestamps | order_id |
| ORDER_ITEMS | 112,650 | Product, seller, price and freight per line | order_id + order_item_id |
| ORDER_PAYMENTS | 103,886 | Payment components and method | order_id + payment_sequential |
| ORDER_REVIEW_RATINGS | 100,000 | Customer review scores | review_id, order_id |
| PRODUCTS | 32,951 | Product attributes and category | product_id |
| SELLERS | 3,095 | Seller and source-location labels | seller_id |
| GEO_LOCATION | 19,015 | ZIP-prefix coordinate lookup | geolocation_zip_code_prefix |

`CUSTOMERS.customer_id` is an order-level customer record. Use `customer_unique_id` for customer acquisition, repeat-order, and retention analyses.

## Data-quality checks and cleaning decisions

The supplied CSVs have no duplicate complete rows and no orphan order, product, seller, or customer keys. Retain all raw source files unchanged. Use the following documented transformations:

1. Parse all timestamps as **MM/DD/YYYY HH:MM**, not DD/MM/YYYY. This produces the valid period above and avoids false missing delivery dates.
2. Keep `Orders` with their lifecycle status. For sales, AOV, customer repeat, rating, and delivery KPIs, define a completed order as `order_status = 'delivered'` and state this rule in the dashboard subtitle.
3. Aggregate payments to one row per order when calculating order-level revenue. There are 4,446 extra payment rows because some orders use multiple components.
4. Aggregate reviews to one mean score per order for order/customer/seller comparisons. There are 559 extra review rows at order level.
5. Replace the 623 missing product categories with `Unclassified`; preserve missing product attributes as null rather than inventing values.
6. Replace 57 missing seller city/state labels with `Unknown` only for display; do not infer them.
7. Do not interpret 2,965 missing delivered-customer timestamps as failed data: they are expected primarily for orders not delivered.
8. There are 775 orders without item rows and one without payment data. Retain them for status counts, but exclude them naturally from item/revenue detail where the relevant measure is null.

Reproducible profile and extracts: run `python analysis/profile_dataset.py`. It writes `analysis/dataset_profile.json` and the Tableau-ready files under `analysis/tableau_ready/`.

## Tableau data model

### Preferred logical relationships (raw model)

Use **relationships**, not a physical all-table join:

```text
Customers (1) ─ customer_id ─ (1) Orders (1) ─ order_id ─ (M) Order Items ─ product_id ─ (1) Products
                                      │                                  └ seller_id ─ (1) Sellers
                                      ├ order_id ─ (M) Payments
                                      └ order_id ─ (M) Reviews
```

Use the GEO_LOCATION lookup only for a source-coordinate display. If it is used twice, create two aliases: one related to customer ZIP prefix and one to seller ZIP prefix. Do **not** assign geographic roles or make a real-world map.

### Safer dashboard extract model

For the CA3 dashboard, import these prepared extracts instead of physically joining the raw one-to-many tables:

| File | Grain | Recommended use |
|---|---|---|
| `Order_Summary.csv` | one row per order | KPI cards, sales trend, customer and delivery views |
| `Item_Detail.csv` | one row per order item | product/category/seller views; use `COUNTD(order_id)` |
| `Payments.csv` | one row per payment component | payment-method share only |
| `Category_Pairs.csv` | one row per distinct category pair | cross-sell sheet |

Never physically join `Item_Detail` to `Payments` or raw reviews. It will duplicate payment values, item revenue, and ratings.

## Core calculated fields

Create these in Tableau. Field names in brackets are from `Order_Summary.csv` unless stated otherwise.

```tableau
// Delivered Order Flag
IF [order_status] = 'delivered' THEN 1 ELSE 0 END

// Completed Orders
COUNTD(IF [order_status] = 'delivered' THEN [order_id] END)

// Payment Revenue (order-grain source only)
SUM(IF [order_status] = 'delivered' THEN ZN([payment_value]) END)

// Average Order Value
[Payment Revenue (order-grain source)] / [Completed Orders]

// Delivery Days
DATEDIFF('day', [order_purchase_timestamp], [order_delivered_customer_date])

// Delivery Punctuality
IF ISNULL([order_delivered_customer_date]) THEN 'Not delivered'
ELSEIF [order_delivered_customer_date] <= [order_estimated_delivery_date] THEN 'On / before estimate'
ELSE 'Late'
END

// Review Band
IF [review_score] <= 2 THEN 'Low (1–2)'
ELSEIF [review_score] = 3 THEN 'Neutral (3)'
ELSE 'High (4–5)'
END

// Customer First Purchase (LOD)
{ FIXED [customer_unique_id] : MIN([order_purchase_timestamp]) }

// Customer Order Count (LOD)
{ FIXED [customer_unique_id] : COUNTD(
    IF [order_status] = 'delivered' THEN [order_id] END) }

// Customer Type
IF [Customer Order Count (LOD)] = 1 THEN 'One-time'
ELSE 'Repeat'
END

// New / Returning Order
IF [order_purchase_timestamp] = [Customer First Purchase (LOD)] THEN 'New'
ELSE 'Returning'
END

// Item Revenue (Item_Detail only)
SUM([price] + [freight_value])

// Seller Revenue (Item_Detail only)
{ FIXED [seller_id] : SUM([price] + [freight_value]) }

// Seller Activity Segment (Item_Detail only)
IF { FIXED [seller_id] : COUNTD([order_id]) } >= 500 THEN 'High activity'
ELSEIF { FIXED [seller_id] : COUNTD([order_id]) } >= 100 THEN 'Medium activity'
ELSE 'Low activity'
END
```

For dashboard filters to affect FIXED LODs, right-click the relevant filter and select **Add to Context**. For customer/seller contribution bands, use a parameterized threshold or Tableau’s `RANK()` table calculation rather than hard-coding a conclusion.

## Dashboard plan

Build three linked dashboards in one workbook. Use a clean neutral palette: dark navy for headings, teal for favourable measures, amber for attention, and red only for clearly adverse measures. Add `Data period: 04 Sep 2016–17 Oct 2018 | Completed orders only unless stated` below every title.

### 1. Executive performance overview

Top row KPI cards: Completed Orders, Payment Revenue, AOV, Average Rating, Average Delivery Days, and On/Before Estimate %.

- Monthly revenue line with monthly completed-order bars on a dual axis.
- Order-status stacked bar.
- Payment revenue share horizontal bar (from `Payments.csv`).
- Delivery punctuality vs average rating dot/bar view.
- Global filters: purchase date, status, customer source-location label, and payment type.
- Click a month to filter the category and seller dashboards; include a reset button.

### 2. Customer, product, and cross-sell dashboard

- New versus returning order trend, based on `customer_unique_id`.
- One-time versus repeat customer KPI and customer order-count distribution.
- Top 10 category revenue bar; a companion rating dot plot with an order-volume reference line.
- Category pair network-like table or two-column highlight table from `Category_Pairs.csv`; show co-purchased orders and a confidence qualifier.
- Filters: date, category, review band, customer type.

### 3. Seller, satisfaction, and source-location dashboard

- Seller scatter: revenue on X, average rating on Y, order count on size; label only top/review-risk sellers.
- Seller activity segment stacked bar and sortable seller table.
- Ranked bars by **customer source-location label** and seller source-location label. Avoid a geographic map because the supplied labels/coordinates are not validated real geography.
- Rating distribution and late-delivery rating comparison.
- Filters: date, category, seller activity segment, delivery punctuality, customer source-location label.

Tooltips should explain the definition and show: completed orders, payment revenue or item revenue (never mix them without labelling), AOV, average rating, and the selected filter scope. Add the subtitle `Source-defined location labels; not validated geographic representation` to location visuals.

## Findings from the supplied data

All figures below use delivered orders unless otherwise noted.

- 96,478 delivered orders were placed by 93,358 unique customers, generating payment revenue of **15,422,461.77**. AOV is **159.86**, average review score **4.14/5**, and average delivery time **12.56 days**.
- The highest-revenue month is **November 2017** with **1,153,528.05** payment revenue across **7,289** delivered orders. April and May 2018 are close next peaks (1,132,933.95 and 1,128,836.69).
- Only **2,801 of 93,358** delivered-order customers made at least two purchases: a **3.00% repeat-customer rate**. Retention/cross-sell campaigns should therefore be treated as a material opportunity, not a proven success.
- Credit card components account for **78.34%** of raw payment revenue and UPI for **17.92%**. This is payment-component revenue; an order with multiple payment methods can appear in more than one type.
- By item revenue, Health_Beauty leads at **1,412,089.53**; Watches_Gifts and Bed_Bath_Table follow. Bed_Bath_Table has the largest units among the top categories (10,953), but its 3.90 average rating is below the overall 4.14.
- Among categories with at least 500 delivered orders, Office_Furniture has the lowest average rating (**3.50**, 1,254 orders), making it a stronger satisfaction investigation candidate than a low-volume category.
- Punctuality has a pronounced satisfaction association: on/before-estimate orders average **4.28**, 1–7 days late average **3.16**, and 8+ days late average **1.72**. This is association, not proof that lateness alone caused the rating.
- The leading observed category pair is Bed_Bath_Table + Furniture_Decor (**70 orders**), followed by Bed_Bath_Table + Home_Confort (**43**). These counts are low relative to total orders, so present them as candidates for testing, not automatic bundle decisions.
- The top ten sellers account for **12.93%** of item revenue. One high-volume seller (`7c67…010ab`) has 973 orders and a comparatively low 3.34 rating, so it merits seller-quality review.
- The largest source-location revenue label contributes **58.74%** of delivered-order payment revenue. Report it only as a source label, never as verified country/state market concentration.

## Methodology for the written case study

1. Define business questions from the ten objectives and specify the grain of every measure.
2. Profile source data for counts, keys, nulls, date validity, duplicates, and referential integrity.
3. Clean only documented defects; preserve raw data and create separate analytical extracts.
4. Model tables with Tableau relationships or prepared one-grain extracts to prevent fan-out.
5. Define metrics (especially delivered order, payment revenue, item revenue, repeat customer, and on-time delivery) before visualisation.
6. Build sheets, validate every headline KPI against `analysis/dataset_profile.json`, then compose linked dashboards.
7. Use filters/actions/tooltips for exploration and document data limitations directly in the workbook.
8. Interpret descriptive findings as evidence for investigation and experiments, not causal claims.

## Tableau Creator versus Viewer

| Area | Creator | Viewer |
|---|---|---|
| Main role | Builds and publishes data sources, workbooks, and dashboards | Consumes governed published content |
| New connections/data sources | Can create them | Cannot create/publish them |
| Authoring | Can create and edit workbooks | Cannot author or publish workbooks |
| Interactivity | Full authoring plus viewing | Can filter, sort, inspect tooltips, and interact with permitted views |
| Appropriate project use | Analyst develops and publishes this CA3 workbook | Lecturer/manager consumes the published dashboard |

Permissions can alter download, saving, sharing, and data visibility. Confirm the site policy rather than assuming every Viewer has the same permissions. Official Tableau documentation: https://help.tableau.com/current/pro/desktop/en-us/web_author_overview.htm and https://help.tableau.com/current/online/en-us/permission_license_siterole.htm.

## Privacy, security, and ethics

- **Data minimisation:** dashboard users need pseudonymous IDs and aggregated performance; do not expose raw customer IDs, ZIP prefixes, or precise coordinates unnecessarily.
- **Access control:** publish to a governed project; use least-privilege permissions. Viewer access should be enough for stakeholders who only consume findings.
- **Secure handling:** keep source extracts in approved storage, encrypt data at rest/in transit where the platform supports it, and do not upload datasets to unapproved public services.
- **Retention and auditability:** retain the raw source, transformation script, dashboard version, and metric definitions so results can be reproduced; delete working copies according to the organisation’s retention policy.
- **Bias and interpretation:** source-location fields are not validated geography. Avoid geographic stereotyping, do not infer protected attributes, and do not use ratings alone for punitive seller decisions. Check volume and delivery context.
- **Transparency:** label delivered-order scope, distinguish payment revenue from item revenue, disclose missing/aggregated records, and avoid causal wording for descriptive correlations.

## Presentation outline (12 slides)

1. **Title** — project title, student details, Tableau, and “public e-commerce marketplace dataset.”
2. **Business problem** — fragmented transaction/customer/product/seller data impedes decisions.
3. **Objectives** — group the ten objectives into performance, customer/product, seller/location, and cross-sell.
4. **Dataset and scope** — table list, 2016-09-04 to 2018-10-17, source-defined geography limitation.
5. **Cleaning and validation** — MM/DD parsing, missing values, duplicate payment/review rows, delivered-order definition.
6. **Data model** — relationship diagram and the fan-out risk avoided by order summaries.
7. **Dashboard design** — three dashboards, filters/actions/tooltips, key KPI definitions.
8. **Executive results** — 96,478 orders, 15,422,461.77 payment revenue, 159.86 AOV, 4.14 rating, 12.56 delivery days.
9. **Customer/product results** — 3.00% repeat rate, category leaders, rating gap.
10. **Seller/service/cross-sell results** — late delivery versus ratings, seller review candidate, category-pair candidates.
11. **Recommendations** — delivery-exception control, category quality review, retention experiment, seller scorecard, controlled bundles.
12. **Limitations, ethics, and conclusion** — descriptive not causal; source geography disclaimer; reproducible project files.

## Viva questions and short answers

1. **Why did you use relationships rather than joins?** Raw payments, reviews, and items are all one-to-many from orders. A physical join multiplies rows and inflates measures; relationships or order-level summaries preserve grain.
2. **What is your unit of analysis?** It depends on the sheet: one delivered order for headline KPIs, one item row for product/seller revenue, one payment component for payment preference, and one unique customer for retention.
3. **Why is `customer_unique_id` used for repeat analysis?** `customer_id` is an order-address snapshot and is unique per order here; the unique ID identifies the same customer across orders.
4. **Why define completed as delivered?** It is a transparent fulfilment rule that avoids treating cancelled, created, or in-process orders as realised customer outcomes. The dashboard labels this scope.
5. **What is the difference between payment revenue and item revenue?** Payment revenue sums payment components per order; item revenue sums price plus freight per item. Use payment revenue for order KPIs and item revenue for category/seller analysis; do not mix them silently.
6. **How did you handle repeated payment/review rows?** I aggregate payment value and review score to order level when the metric is order-grain, while retaining raw components for payment-method analysis.
7. **How did you calculate retention?** I used a FIXED LOD to count delivered orders per `customer_unique_id`; customers with two or more are repeat customers. The observed rate is 3.00%.
8. **What does the late-delivery result prove?** It shows a strong association with lower ratings, not causality. Other factors such as product quality or service may contribute.
9. **Why didn’t you make a map?** The supplied location labels and coordinates are not validated real geography. A map could falsely imply location accuracy, so ranked source-label visuals are more ethical.
10. **What would you recommend to the business?** Investigate late orders first, monitor low-rating/high-volume categories and sellers, test targeted second-purchase incentives, and experiment with the observed category pairs rather than assuming they will convert.
11. **What does Tableau Viewer do?** It lets stakeholders interact with permitted published dashboards but does not author or publish new data sources/workbooks; Creator is used to build this project.
12. **How did you ensure reproducibility?** The raw CSVs are untouched; `analysis/profile_dataset.py` generates the extracts and `dataset_profile.json` used to validate dashboard KPIs.
