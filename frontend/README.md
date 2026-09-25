# CommerceIQ frontend

Responsive React dashboard companion for the Tableau CA3 case study.

## Commands

```powershell
npm install
npm run dev
npm run build
npm run lint
```

The development server prints the local URL (normally `http://localhost:5173`).

## Data contract

The application fetches `/dashboard-data.json` from `public/`. Do not manually edit this file: regenerate it from the repository root with:

```powershell
python analysis/profile_dataset.py
```

The page deliberately differentiates payment revenue (order-level) from item revenue (category/seller-level), and labels location fields as source-defined rather than verified real-world geography.
