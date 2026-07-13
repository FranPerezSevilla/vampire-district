# Google Sheets feedback collector

The game includes an in-game playtest feedback form loaded from:

- `css/feedback.css`
- `js/feedback-config.js`
- `js/feedback.js`

By default, feedback is stored locally in the browser because no external endpoint is configured yet.

To send feedback to a Google Sheet, use Google Apps Script.

## 1. Create the sheet

Create a Google Sheet named something like:

```txt
Vampire District Feedback
```

Add a tab called:

```txt
Feedback
```

Recommended header row:

```txt
timestamp,rating,liked,disliked,missing,playerName,buildVersion,missionVerdict,exposure,hunger,objective,layer,visibility,lastMessage,timePlayedSeconds,pageUrl,userAgent,viewport
```

## 2. Add Apps Script

Open:

```txt
Extensions -> Apps Script
```

Paste this script:

```js
const SHEET_NAME = "Feedback";

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const data = JSON.parse(e.postData.contents || "{}");
    const snapshot = data.snapshot || {};

    sheet.appendRow([
      new Date(),
      data.rating || "",
      data.liked || "",
      data.disliked || "",
      data.missing || "",
      data.playerName || "",
      snapshot.buildVersion || "",
      snapshot.missionVerdict || "",
      snapshot.exposure || "",
      snapshot.hunger || "",
      snapshot.objective || "",
      snapshot.layer || "",
      snapshot.visibility || "",
      snapshot.lastMessage || "",
      snapshot.timePlayedSeconds || "",
      snapshot.pageUrl || "",
      snapshot.userAgent || "",
      snapshot.viewport || ""
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## 3. Deploy as web app

Use:

```txt
Deploy -> New deployment -> Web app
Execute as: Me
Who has access: Anyone
```

Copy the `/exec` URL.

## 4. Configure the game

Open:

```txt
js/feedback-config.js
```

Set:

```js
window.VD_FEEDBACK_ENDPOINT = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
```

Commit and deploy.

## Notes

- The frontend uses `fetch(..., { mode: "no-cors" })` so the browser can send feedback without CORS setup.
- Because `no-cors` responses are opaque, the frontend treats a completed request as sent.
- If the endpoint is empty or sending fails, feedback is stored in `localStorage` and can be downloaded from the in-game feedback panel.
