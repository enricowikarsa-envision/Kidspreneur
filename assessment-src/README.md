# KidsPreneur Strength Assessment

Interactive pre-class assessment for KidsPreneur participants aged 9–12.

## Local development

```bash
npm install
npm run dev
```

## Google Sheets connection

1. Create a Google Sheet.
2. Open **Extensions → Apps Script**.
3. Paste the contents of `google-apps-script.gs`.
4. Deploy as a Web App with execute access set to the Sheet owner and access allowed for anyone with the link.
5. Configure the deployed URL as the server-side `GOOGLE_SHEETS_WEBHOOK_URL` environment variable.
6. Redeploy the website so the environment revision is active.

The website proxies submissions through `/api/submit`, so the Apps Script URL is not exposed in the browser. The Apps Script creates an `Assessment Results` tab automatically and rejects duplicate participant codes.
