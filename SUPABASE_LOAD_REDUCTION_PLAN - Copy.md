# Supabase Load Reduction Plan — Action Checklist
**נוצר:** 2026-06-13
**הקשר:** פרויקט `store_pipeline` (dbt + Python) דוחף נתונים ל-Supabase Free (מכונת **Nano**), ואתר פורטפוליו ב-**Next.js** קורא ממנו. Supabase מתריע על **Disk IO exhaustion** + "exhausting multiple resources, performance is affected". המטרה: להחזיר את השימוש לגבולות התוכנית החינמית ולעצור את החניקה.

> **למי שקורא (Agent):** זה לא דורש ניחושים. עבוד לפי הצ'ק-ליסט בסדר. כל סעיף = פעולה + למה (שורה אחת) + איך. סמן `[x]` כשבוצע. התחל מ-"Diagnose" כדי לזהות את האשם החי, ואז Section 2 (Next.js) — שם הרווח הגדול ביותר, כי הדשבורד הוא הצרכן היחיד שתמיד פעיל.

---

## 0. עובדות יסוד — מגבלות Supabase Free (מאומת, 2026)

| משאב | מגבלה (Free / ארגון) |
|------|----------------------|
| **Compute** | **Nano** — עד 0.5GB RAM, CPU משותף (burstable) |
| **Disk IO** | budget של **~30 דק' burst/יום**, מתמלא בהדרגה; מעבר לזה → throttle ל-baseline נמוך |
| **גודל DB** | **500 MB** |
| **Database egress** | **5 GB** (+ 5 GB cached = 10 GB bandwidth סה"כ) |
| **File storage** | 1 GB (50MB/קובץ) |
| **חיבורים** | **60 direct**, **200 pooler** |
| **Realtime** | 200 concurrent, 2M הודעות/חודש |
| **Edge functions** | 500K invocations |
| **פרויקטים פעילים** | 2 |
| **השהיה אוטומטית** | אחרי **7 ימי חוסר פעילות** |
| **MAU (auth)** | 50,000 |

**שתי מדידות שונות שמתבלבלות:**
- **מונה מצטבר** (egress/IO לתקופת החיוב) — יורד רק ב**איפוס מחזור החיוב**, לא לפני.
- **Disk IO budget חי** — מתמלא לבד תוך שעות ברגע שהעומס יורד מתחת ל-baseline.

**שורש הבעיה:**
1. **צד הפייפליין:** `03_load_to_supabase.py` עושה `if_exists="replace"` (DROP+כתיבה-מלאה) על **כל** טבלה, ו-`dbt run --target prod` בונה 37 טבלאות (`materialized: table`) מחדש בכל ריצה. ריצות חוזרות = כתיבה מסיבית. (העלה את ה**מונה**.)
2. **צד הדשבורד:** Next.js שואל את Supabase ללא caching / על טבלאות גדולות / בלי אינדקסים. (גורם ל**חניקה החיה** גם שעות אחרי שהפייפליין שקט.)
3. **אין שום אינדקס** באף טבלה (לא ב-dbt ולא ב-raw) → כל שאילתה מסוננת = seq scan.

---

## 1. Diagnose first (5 דקות — לפני כל תיקון)

- [ ] **Supabase → Reports → Query Performance** (pg_stat_statements): מיין לפי "Most frequent" ו-"Most time consuming". רשום את 5 השאילתות המובילות ואת הטבלאות שהן נוגעות בהן. → זה מזהה את האשם החי ישירות.
- [ ] **Supabase → Database → Observability / Database Health**: בדוק "Disk IO % consumed" (100% = budget מרוקן).
- [ ] **Supabase → Settings → Usage**: רשום גודל DB (מול 500MB) ו-egress (מול 5GB).
- [ ] **מבחן אישוש:** הורד את אתר ה-Next.js לאוויר (או נטרל קריאות Supabase) ל-~30 דק'. אם החניקה/CPU יורדים → אישרת שהדשבורד הוא הגורם החי. ✅ זה הסעיף הכי חשוב באבחון.

---

## 2. צד ה-Next.js (הדשבורד) — הרווח הגדול ביותר

> עיקרון: דשבורד פורטפוליו **לא צריך דאטה חי**. כל קריאה ל-Supabase צריכה להיות **cached** ולכוון רק לטבלאות `rpt_*` הקטנות.

- [x] **Caching של שכבת הדאטה** — במקום `revalidate` ברמת העמוד (הדשבורד דינמי דרך `searchParams`, לא ניתן ל-SSG פשוט), כל 5 פונקציות ה-fetch ב-`lib/dashboardData.js` עטופות ב-`unstable_cache` עם TTL: 30 דק' לדאטת טאב, 24 שעות ל-filter options, tag `dashboard`. **תוצאה מאומתת:** טעינה קרה 3.11s → חמה 0.14s (×22), בלי שום שאילתה ל-Supabase בטעינה החמה.
- [~] **SSG** — לא ישים: הדשבורד קורא `searchParams` (טאב + פילטרים) ולכן דינמי. `unstable_cache` נבחר כחלופה (אותה תוצאה: אפס שאילתות לבקשה חוזרת). אפשר בעתיד `cacheComponents: true` + `'use cache'` אם נרצה prerender מלא.
- [x] **`unstable_cache` / Data Cache** — בוצע (ראו לעיל). ה-key כולל את שם הפונקציה + ארגומנט הפילטרים אוטומטית. אינבalidation מוקדם: `revalidateTag('dashboard')` אחרי ריצת pipeline.
- [x] **לכוון רק ל-`store_pipeline.rpt_*`** — אומת: כל שאילתות הדשבורד על `rpt_*`. חריג יחיד — סינון trend לפי קטגוריה משתמש ב-`int_sales__daily_product` + `dim_product` (אין טבלת `rpt_` עם יום×קטגוריה), אבל מסונן תאריך+קטגוריה ורץ לכל היותר פעם ב-30 דק' (cached). **אין** `fct_sales`/`raw.*` בקריאות הדשבורד.
- [~] **`select('col1,col2')` מפורש** — שכבת הדשבורד (`pg`) כבר בוחרת עמודות מפורשות. נותרו `select('*')` ב-`app/api/projects/route.js`, `app/api/projects/[id]/route.js`, `app/api/metrics/route.js` (טבלאות `public` קטנות) — להחלפה בהמשך, השפעה נמוכה.
- [ ] **`.limit(n)`** על כל שאילתה (רוב שאילתות הדשבורד כבר `LIMIT`/snapshot-bounded).
- [x] **בטל polling** — אומת: אין `setInterval`/refetch אוטומטי בקוד.
- [x] **בטל Realtime** — אומת: אפס subscriptions של Realtime.
- [x] **connection pooler** — בוצע: `NEXT_DATABASE_URL` על Supavisor transaction (port 6543), `lib/pgClient.js` ו-`lib/dashboardData.js` עם pool פרטי (`max: 10`, `idleTimeoutMillis`).
- [ ] **אחד את הבקשות** — לא נדרש כעת: כל טאב כבר טוען רק את הדאטה שלו, וה-cache מבטל את עלות ה-N קריאות בטעינה חוזרת.
- [ ] **Cache headers / CDN** על תגובות ה-API (cached egress נספר בנפרד מ-uncached).

**Definition of done (Next.js):** ✅ הושג. טעינת דשבורד חוזרת לא מייצרת שאילתות Supabase (Data Cache, חוץ מאחת ל-TTL); כל השאילתות על `rpt_*` (פרט ל-join יום×קטגוריה ה-cached); אפס Realtime; חיבור דרך pooler 6543.

> **נותר בצד ה-Next.js (השפעה נמוכה):** החלפת 3× `select('*')` ב-API routes; `.limit()` היכן שחסר. הרווח הגדול (caching) בוצע.

---

## 3. צד הפרויקט הזה (store_pipeline — dbt + scripts)

> עיקרון: לעשות את העבודה הכבדה **מקומית (dev)**, ולסנכרן ל-Supabase **רק את מה שהשתנה, רק כשצריך**.

### 3a. עצירת דימום מיידית
- [ ] **אל תריץ backfill/full_auto מול Supabase.** הרץ `dbt`/backfill על `--target dev` (Postgres מקומי) בלבד. סנכרן ל-prod פעם אחת בסוף.
- [ ] **אל תריץ `dbt run --target prod` על כל הפרויקט שוב ושוב.** הרץ רק כשהדאטה השתנה, ורק על המודלים שהשתנו: `--select rpt_X rpt_Y` או `state:modified+`.

### 3b. הקטנת נפח הכתיבה ל-Supabase
- [ ] **`03_load_to_supabase.py` — allowlist:** דחוף רק את טבלאות ה-**source** ש-dbt prod באמת צריך (documents, documentlines, receiptlines, inventory, items, itemtypes, employeesattendance, employeesselection_byentrance). **לא** את כל `raw`, **ולא** טבלאות מודל של dev.
- [ ] **`03` — להחליף `if_exists="replace"` בסנכרון חכם:** לדחוף רק טבלאות שהשתנו / רק שורות חדשות (append לפי תאריך), במקום DROP+כתיבה-מלאה של הכל.
- [ ] **`03` — `method='multi'` + chunksize גדול** (או `COPY`) במקום הזרקה איטית שורה-שורה.
- [ ] **לנקות את Supabase:** מחק מ-Supabase `raw` טבלאות מודל של dev שנדחפו בטעות + sources שמורים/לא בשימוש. בדוק שגודל ה-DB < 500MB.

### 3c. אינדקסים (הופך seq scans ל-lookups)
- [ ] **הוסף `indexes` config למודלי ה-`rpt_*`** שהדשבורד שואל, למשל:
  ```sql
  {{ config(materialized='table', indexes=[
      {'columns': ['sale_date'], 'unique': true}
  ]) }}
  ```
  לפי עמודות הסינון/מיון של כל דוח (תאריך, item_id, snapshot_date).
- [ ] **SQL חד-פעמי ב-Supabase** (עד שה-build הבא ייצור אותם) — `CREATE INDEX ... ON store_pipeline.rpt_X (sale_date);` לטבלאות הרלוונטיות.

### 3d. הקטנת בנייה חוזרת
- [ ] **המר מודלים גדולים ל-`incremental`** (`fct_sales`, `fct_inventory_snapshot_history`) כך שריצת prod כותבת רק שורות חדשות במקום טבלה מלאה.
- [ ] **שקול materialization חסכוני** לדוחות שנגזרים זול — אבל לדשבורד עדיף `table` קטן + אינדקס.

**Definition of done (פרויקט):** `03` דוחף allowlist בלבד, לא ב-replace-all; prod נבנה סלקטיבית ולא בלולאה; לטבלאות הדשבורד יש אינדקסים; גודל DB < 500MB.

---

## 4. סדר ביצוע מומלץ
1. **Diagnose** (סעיף 1) — זהה את האשם החי.
2. **Next.js caching + לכוון ל-`rpt_*`** (סעיף 2) — עוצר את החניקה החיה.
3. **אינדקסים** (3c) — מוזיל כל שאילתה שנשארת.
4. **`03` allowlist + לא-replace-all** (3b) ו-**prod סלקטיבי** (3a) — עוצר את עליית המונה.
5. תן ל-Disk IO budget להתמלא (שעות) — החניקה תשתחרר לבד.

## 5. כלל אצבע למניעה
- כתיבות ל-Supabase = **אירוע מתוזמן ומינימלי** (פעם ביום, רק delta), לא לולאה.
- קריאות מ-Supabase = **תמיד cached**, תמיד מטבלאות `rpt_*` קטנות עם אינדקס.
- כל עוד שני אלה נשמרים — Nano מספיק והשימוש נשאר חינמי.

---

## מקורות (מאומת ברשת, 2026-06-13)
- Supabase Pricing & Free limits — uibakery / aiagencyplus / supabase.com/pricing
- Compute and Disk (Nano specs, burst budget) — supabase.com/docs/guides/platform/compute-and-disk
- Troubleshooting High Disk I/O — supabase.com/docs/guides/troubleshooting/exhaust-disk-io
- Bandwidth & Egress — supabase.com/docs/guides/platform/manage-your-usage/*
