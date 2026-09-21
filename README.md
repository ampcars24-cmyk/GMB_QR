# Cars24 unified review QR

This static page routes a customer from one QR code to the Google review form for the nearest Cars24 location. It uses browser geolocation only after the customer taps **Use my location**. Customers can always search for a branch manually. The deployed `index.html` is bundled with the location data, so it can be deployed by itself.

The customer must choose a review intent first:

- **I bought a car** shows only `C1/` locations.
- **I sold a car** shows only `A1/`, `A2/`, `A3/`, `B1/`, and `D2/` locations.
- All other store-code groups are excluded from both paths.

## Build location data

From the workspace root, run:

```powershell
node .\build_review_data.mjs
```

The source CSV should be the listing export at `C:\Users\40980\Downloads\CARS24- Listing Details-2026-09-15_13-59.csv`. The generated `review-router/branches.js` contains only locations with latitude, longitude, and a Google review URL.

To rebuild the self-contained page after changing the source CSV, run:

```powershell
node .\build_review_data.mjs
node .\build_review_bundle.mjs
```

## Deploy and make the QR

Deploy the `review-router` folder to an HTTPS URL, for example:

`https://reviews.example.com/`

The QR code should encode that public URL, not a local file path. Geolocation requires HTTPS and customer permission. If permission is denied, the page provides manual branch search.

## Review-policy safeguards

The page sends every customer to the Google review form after branch selection. It does not filter customers by sentiment or request a particular star rating. Do not offer incentives in exchange for reviews.
