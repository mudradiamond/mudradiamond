# 🚀 Deploy Guide — Mudra Diamond

આમાં ત્રણ વસ્તુ છે:
1. Website ને free permanent link પર live કરવી
2. Cloud database (Supabase) જોડવો
3. Android APK phone માં install કરવો

---

## 1. Website live કરવી (GitHub Pages — free, કાયમી)

તમને મળશે એવી link:

```
https://<તમારું-github-username>.github.io/mudra-diamond/
```

આ link **કાયમી** છે, **free** છે, **HTTPS** છે અને domain ખરીદવાની જરૂર નથી.

### Step 1 — GitHub account

[github.com/signup](https://github.com/signup) પર free account બનાવો.
(Account હું તમારા વતી બનાવી ન શકું — એ તમારે જ કરવું પડે.)

### Step 2 — નવો repository

1. [github.com/new](https://github.com/new) ખોલો
2. **Repository name**: `mudra-diamond`
3. **Public** પસંદ કરો
   > GitHub ના free plan પર Pages માટે repo public હોવો જરૂરી છે.
   > નીચે "Security" વાંચો — એટલે જ દરેક default password એક જ વાર ચાલે છે.
4. README/gitignore/license **ઉમેરવા નહીં** — બધું આ folder માં તૈયાર છે
5. **Create repository**

### Step 3 — Code upload

`F:\MUDRA` folder માં terminal ખોલીને (username બદલીને):

```bash
git remote add origin https://github.com/YOUR-USERNAME/mudra-diamond.git
git branch -M main
git push -u origin main
```

પહેલી વાર GitHub username અને **Personal Access Token** માંગશે (password નહીં).
Token અહીંથી બનાવો: **GitHub → Settings → Developer settings →
Personal access tokens → Tokens (classic) → Generate new token** → `repo` પર ✓ કરો.

### Step 4 — Pages ચાલુ કરો

1. Repository → **Settings** → ડાબી બાજુ **Pages**
2. **Source**: `Deploy from a branch`
3. **Branch**: `main`, folder: `/ (root)` → **Save**
4. 1-2 મિનિટ રાહ જુઓ

તમારી કાયમી link તૈયાર:

```
https://YOUR-USERNAME.github.io/mudra-diamond/
```

### પછી કંઈ બદલવું હોય તો

```bash
git add -A
git commit -m "update"
git push
```

એક મિનિટમાં website update — બધા phone અને computer પર આપોઆપ.

---

## 2. Cloud database (Supabase — free)

Supabase વગર દરેક device નો data અલગ રહેશે. બધા એક જ data જુએ એ માટે:

1. [supabase.com](https://supabase.com) → free account → **New project**
   (Region: **Mumbai / ap-south-1** સૌથી ઝડપી પડશે)
2. Database password લખી રાખો
3. **SQL Editor** → **New query** → `supabase_schema.sql` ની આખી file paste → **Run**
4. **Project Settings → API** માંથી copy કરો:
   - `Project URL` → જેમ કે `https://abcdefgh.supabase.co`
   - `anon` `public` key → લાંબી `eyJ...` string
5. Website ખોલો → **admin** થી login → **⚙️ Settings** → બંને paste → **Save & Test**
6. ✅ દેખાય એટલે **🔄 Sync Now** દબાવો

હવે દરેક phone/computer પર એ જ URL + key નાખો. બધા એક જ data જોશે.

> ⚠️ `service_role` key ક્યારેય app માં ન નાખવી — ફક્ત `anon` `public`.

---

## 3. Android APK

### તૈયાર APK

`android/MudraDiamond-5.0.0.apk`

Website live થયા પછી APK ને repo માં મૂકી દો, એટલે કોઈ પણ આ link થી download કરી શકે:

```
https://YOUR-USERNAME.github.io/mudra-diamond/android/MudraDiamond-5.0.0.apk
```

### Phone માં install

1. Phone માં ઉપરની link ખોલો → APK download થશે
2. Download પર tap કરો
3. Android કહેશે *"આ સ્રોતની apps install કરવાની પરવાનગી નથી"* → **Settings** →
   **આ સ્રોતને મંજૂરી આપો** ચાલુ કરો → પાછા આવો
4. **Install** → **Open**

> Play Store પર નથી એટલે આ ચેતવણી આવે છે. App તમારી પોતાની signed key થી sign થયેલી છે.

### APK શું કરે છે

- Website ખોલે છે — એટલે **website update કરો એટલે બધા phone માં આપોઆપ update**, નવો APK આપવો ન પડે
- એક વાર સફળ ખૂલ્યા પછી **internet વગર પણ ખૂલે** છે (service worker)
- **Excel** download → phone ના Downloads folder માં
- **PDF / Print** → Android નું print / save-as-PDF
- Back button → app ની અંદર પાછળ જાય

### URL બદલવો હોય તો

`android/app.properties` માં `mudraUrl` બદલો, પછી:

```bash
cd android && ./build-apk.sh
```

અથવા સીધું:

```bash
cd android && ./build-apk.sh https://your-new-url/
```

નવો signed APK `android/` માં બની જશે (Gradle વગર, ~15 સેકન્ડ).

**જરૂરી**: Android SDK (build-tools 34.0.0 + platform 34) અને JDK 17.

---

## 🔑 Keystore — સાચવવી જરૂરી

```
android/mudra-release.keystore
android/signing.properties
```

આ બે file **git માં જતી નથી** (`.gitignore` માં છે) — અને એ બરાબર છે.
પણ **તેની backup અલગ સાચવો** (pendrive / Google Drive).

આ ખોવાઈ જાય તો હાલની app ને update કરી શકાશે નહીં — user ને જૂની app કાઢીને
નવી install કરવી પડે, અને એ device નો local data જતો રહે.

---

## Security — શું ધ્યાનમાં રાખવું

| વાત | અર્થ |
|---|---|
| Website public link પર છે | link જેની પાસે હોય તે login screen જોઈ શકે — data નહીં |
| Password hash public file માં છે | એટલે જ **દરેક default password એક જ વાર ચાલે છે**, પછી બદલવો ફરજિયાત |
| Role gating browser માં છે | ખરી સુરક્ષા Supabase RLS થી આવે — `supabase_schema.sql` વાંચો |
| anon key public છે | Supabase નું normal design; રક્ષણ RLS કરે છે |

**સૌથી અગત્યનું**: બધા user પાસે પહેલા login વખતે નવો password સેટ કરાવો,
અને `CREDENTIALS.txt` કોઈને WhatsApp/email પર ન મોકલો — રૂબરૂ જણાવો.
