# v-one AI Assistant — Guide

v-one ships with two Google Gemini features:

1. **Scan Bill (AI)**: upload a photo or PDF of a bill. Gemini reads the vendor, bill number, dates, items, GST and totals. You **review and edit everything** on screen, then press **Confirm & save**. Nothing is saved before you confirm.
2. **v-one Assistant (chatbot)**: the ✨ button at the bottom-right of every page. It answers questions about your business from your live data, explains how to use the app, and helps with anything else (reminder messages, GST maths, emails, translations, business questions).

---

## 1. Setup (one time)

1. Get a free Gemini API key: <https://aistudio.google.com/apikey>
2. Put it in the backend `.env` file (`backend/.env` locally, `public_html/backend/core/.env` on hPanel):

   ```env
   GEMINI_API_KEY=your-key-here
   GEMINI_MODEL=gemini-3.5-flash      # optional; if it is unavailable for your key, current models are tried automatically
   AI_REQUESTS_PER_MINUTE=15          # optional, per user
   AI_REQUESTS_PER_DAY=500            # optional, per organization
   ```
3. On a server with cached config, run `php artisan config:clear` (or delete `bootstrap/cache/config.php`).

The key stays on the server. The browser only talks to your own Laravel API (`/api/ai/*`).
If the key is missing, the app still works and the AI screens say *"AI assistant is not configured"*.

---

## 2. Scanning a bill

Open **Purchases → Scan Bill (AI)**, click **Scan Bill** in the top bar, type `/scan` in the chat, or press **📎** in the chat.

| Step | What happens |
|---|---|
| **1. Upload** | Drag-drop or choose a JPG / PNG / WEBP / HEIC photo or a PDF (max 10 MB). On a phone you can take a photo directly. |
| **2. AI reads it** | Gemini extracts the vendor (name, GSTIN, phone, address), vendor bill #, bill & due dates, line items (qty, unit, rate before tax, discount, GST %), and totals. |
| **3. Review** | The bill is shown next to an editable form. v-one has already matched: **existing vendor** (by GSTIN, then name), **existing items** (by name/SKU), **GST rate** (to your tax list), and an **expense category** guess. |
| **4. Fix anything** | Change any field. Pick a different vendor or item, untick **Create as new item**, switch **Purchase bill ⇄ Expense**, choose **Open** or **Draft**. The page compares your total with the total printed on the bill and offers **"adjust to match bill"** for round-off differences. |
| **5. Confirm** | **Confirm & save** shows a summary (vendor, date, total, new vendor/items to be created). Press **Yes, save** to save it. |

**Bill vs Expense**
- **Purchase bill**: for stock or goods bought from a supplier. Adds stock (when *Open*), shows in Payables, counts as GST input.
- **Expense**: for one-off spends like rent, electricity, fuel, internet. Pick a category and, if you like, the account it was paid from.

**Tips for good results:** a flat, well-lit photo with all four corners visible; one bill per photo; PDFs from email work best.

---

## 3. Chatbot commands

Type `/` in the chat to see suggestions (↑/↓ to move, **Tab** or **Enter** to pick). You don't have to use commands: plain questions work too.

| Command | What it does | Example |
|---|---|---|
| `/help` | Lists all commands | `/help` |
| `/scan` | Opens the file picker to scan a bill (same as 📎) | `/scan` |
| `/summary` | Business snapshot: receivables, overdue, payables, this month's sales, expenses, cash received, items needing attention | `/summary` |
| `/sales [period]` | Sales for a period, with top customers | `/sales last month` |
| `/dues` | Who owes you money (receivables aging) | `/dues` |
| `/overdue` | Overdue customer invoices, highest first | `/overdue` |
| `/payables` | What you owe vendors (payables aging) | `/payables` |
| `/expenses [period]` | Expenses by category | `/expenses this month` |
| `/pl [period]` | Profit & loss | `/pl this financial year` |
| `/gst [period]` | GST output, input credit and net payable | `/gst last quarter` |
| `/stock [item]` | Low-stock items, or stock/price of one item | `/stock A4 paper` |
| `/top [period]` | Top customers and best-selling items | `/top this year` |
| `/find <name or phone>` | Look up a customer or vendor with balance | `/find Sharma` |
| `/doc <number>` | Full details of an invoice, bill, estimate… | `/doc INV-00012` |
| `/remind <customer>` | Drafts a polite payment reminder (WhatsApp + email) from their real outstanding invoices | `/remind Ravi Stores` |
| `/new <type>` | Opens a blank form: `invoice`, `bill`, `estimate`, `order`, `credit-note`, `po`, `customer`, `vendor`, `item`, `expense`, `journal` | `/new invoice` |
| `/go <page>` | Jumps to a page: `dashboard`, `customers`, `vendors`, `items`, `invoices`, `estimates`, `orders`, `bills`, `scan`, `expenses`, `received`, `made`, `accounts`, `journals`, `reports`, `pl`, `balance-sheet`, `gst`, `settings`, `profile`, `taxes`, `users` | `/go reports` |
| `/clear` | Starts a new conversation | `/clear` |

`[period]` is free text: `today`, `this month`, `last month`, `last quarter`, `this financial year`, `April 2026`, `1 Jan to 31 Mar`…

**Keyboard**
- **Enter** sends, **Shift + Enter** adds a new line
- **↑** in an empty box brings back your last message
- **Ctrl + /** opens or closes the chat
- **Copy** under a reply copies it, which is handy for reminders and emails

### Things you can just ask

- "How much did I sell this month compared to last month?"
- "Which customers owe me more than ₹10,000 and since when?"
- "Show bills due this week"
- "What's my net GST payable for October?"
- "Is A4 paper running low? What did I pay for it last time?"
- "Write a WhatsApp reminder in Hindi for Ravi Stores"
- "What is 18% GST on ₹4,250, inclusive and exclusive?"
- "Explain the difference between a sales order and an invoice"
- "How do I record a part payment?"
- Any language works (English, Hindi, Tamil, Hinglish…). The assistant replies in the language you use.

Links in replies (like **INV-00012**) open the record directly.

---

## 4. Safety & limits

- The chatbot can only **read** your data. It cannot create, edit or delete anything. It links you to the right page instead.
- Bill scanning only saves after your **Confirm & save → Yes, save**.
- Every lookup is restricted to your own organization (same multi-tenant rules as the rest of the app).
- Rate limits default to 15 AI requests per minute per user and 500 per day per organization (`AI_REQUESTS_PER_MINUTE`, `AI_REQUESTS_PER_DAY`).
- Chat history stays in your browser tab (session storage) and clears when you close the tab or type `/clear`.
- AI can make mistakes. Always check amounts, GST rates and dates before confirming a scanned bill.

---

## 5. For developers

| Piece | File |
|---|---|
| Gemini REST client | `backend/app/Services/Ai/GeminiClient.php` |
| Bill extraction + matching | `backend/app/Services/Ai/BillScanner.php` |
| Saving a confirmed bill/expense | `backend/app/Services/Ai/BillImporter.php` |
| Chatbot + read-only data functions | `backend/app/Services/Ai/AssistantService.php` |
| API endpoints | `backend/app/Http/Controllers/Api/AiController.php` |
| Scan page | `frontend/src/app/features/ai/bill-scan.ts` |
| Chat widget | `frontend/src/app/features/ai/chat-widget.ts` |
| Slash commands | `frontend/src/app/core/ai/chat-commands.ts` |

API (all need the bearer token):

```
GET  /api/ai/status        → { enabled, model }
POST /api/ai/scan-bill     multipart "file"   → preview (nothing saved)
POST /api/ai/import-bill   reviewed preview   → creates vendor/items + bill, or an expense
POST /api/ai/chat          { messages: [{ role: "user"|"model", text }] } → { reply, tools }
```

To add a chat command, add it to `CHAT_COMMANDS` and `parseCommand()` in `chat-commands.ts`.
To give the bot a new data source, add a declaration in `AssistantService::functions()` and a branch in `AssistantService::call()`.
