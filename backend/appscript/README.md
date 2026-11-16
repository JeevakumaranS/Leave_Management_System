# Apps Script email setup

1. Create a Google Apps Script project and paste `code.gs`.
2. In **Project Settings → Script Properties**, add `APPSCRIPT_SHARED_SECRET`. Use a long random value (at least 32 characters).
3. Deploy as a **Web app**, choose **Execute as me**, and set access to **Anyone** so the backend can call it without Google sign-in. The shared secret protects the endpoint; organization policies may restrict this setting.
4. Copy the deployed `/exec` URL into `APPSCRIPT_WEB_APP_URL` in `backend/.env`.
5. Set the same secret in `APPSCRIPT_SHARED_SECRET` in `backend/.env`, then set `APPSCRIPT_ENABLED=true` and restart the backend.

The backend sends JSON containing `secret`, `to`, `subject`, `textBody`, and `htmlBody`. The script returns `{ "ok": true }` only after `MailApp.sendEmail` succeeds. When `APPSCRIPT_ENABLED=false`, no email is sent and the notification log is marked failed. Retry uses the stored text preview.
