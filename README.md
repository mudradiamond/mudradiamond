# 💎 Mudra Diamond — Party Jobwork Management

Jangad, party, process અને payment management. એક જ web app જે computer, mobile
અને Android app — ત્રણેમાં ચાલે છે.

**Version 5.0** — Login + Users + Roles + Offline-first Cloud Sync + Android APK

---

## શું નવું છે (v5.0)

| | |
|---|---|
| 🔐 **Login** | દરેક user નું પોતાનું username અને password |
| 👥 **User Master** | Admin app માંથી જ user add / edit / delete કરી શકે |
| 🎭 **4 Roles** | Admin, Manager, Operator, Viewer — દરેકને અલગ permission |
| 📴 **Offline-first** | Internet ન હોય તો પણ entry થાય, net આવતાં આપોઆપ upload |
| ☁️ **Cloud Sync** | Supabase — બધા user એક જ data જુએ |
| 📱 **Android APK** | એ જ app phone માં, Play Store વગર |
| 📊 **બધા જૂના features** | Dashboard, Ledger, Masters, Payment, Reports, Excel, Print |

---

## Roles — કોણ શું કરી શકે

| | Admin | Manager | Operator | Viewer |
|---|:---:|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| નવી Jangad entry | ✅ | ✅ | ✅ | ❌ |
| Jangad Ledger જોવું | ✅ | ✅ | ✅ | ✅ |
| Entry **Edit** | ✅ | ✅ | ❌ | ❌ |
| Entry **Delete** | ✅ | ✅ | ❌ | ❌ |
| Party Master | ✅ | ✅ | ❌ | ❌ |
| Process / Sub-process Master | ✅ | ✅ | ❌ | ❌ |
| Payment Ledger | ✅ | ✅ | ❌ | ✅ |
| Reports | ✅ | ✅ | ❌ | ✅ |
| Excel / Print | ✅ | ✅ | ✅ | ✅ |
| Cloud Settings | ✅ | ❌ | ❌ | ❌ |
| **User Master** | ✅ | ❌ | ❌ | ❌ |

Role બદલવો હોય તો: `js/auth.js` માં `ROLES` ની `perms` list બદલો.

---

## Data ક્યારેય miss ન થાય — કઈ રીતે

1. **Save દબાવતાં જ** data phone/computer ના localStorage માં લખાય છે — આ ક્યારેય નિષ્ફળ નથી જતું.
2. એ જ change એક **queue** માં પણ મુકાય છે (એ પણ localStorage માં, એટલે app બંધ કરો કે phone
   restart કરો તો પણ ટકે).
3. જ્યારે internet મળે, queue આપોઆપ Supabase માં upload થાય છે.
4. Upload નિષ્ફળ જાય તો queue **એમ જ રહે** છે અને પછી ફરી પ્રયત્ન થાય છે.

Header માં દેખાતું pill હંમેશા સાચી સ્થિતિ બતાવે છે:

| | |
|---|---|
| 🟢 **Synced** | બધું cloud માં ચઢી ગયું |
| 🟡 **N બાકી** | N change હજુ upload થવાના બાકી |
| 🔴 **Offline** | Net નથી — data સચવાયેલો છે, પછી ચઢી જશે |
| ⚪ **Local only** | Supabase set કર્યું નથી — data ફક્ત આ device માં |

Pill પર click કરો એટલે તરત sync થાય.

---

## પહેલી વાર setup

### 1. Cloud database (એક જ વાર)

1. [supabase.com](https://supabase.com) પર free project બનાવો.
2. **SQL Editor** ખોલો → `supabase_schema.sql` ની આખી file paste કરો → **Run**.
3. **Project Settings → API** માંથી `Project URL` અને `anon public` key copy કરો.
4. App માં Admin થી login કરો → **⚙️ Settings** → બંને paste કરો → **Save & Test**.
5. બીજા બધા phone/computer પર એ જ URL અને key નાખો.

> Supabase વગર પણ app પૂરેપૂરી ચાલે છે — પણ ત્યારે દરેક device નો data અલગ રહેશે.

### 2. Users

`CREDENTIALS.txt` માં 5 તૈયાર account છે. **દરેક account નો પહેલો password એક જ વાર
ચાલે છે** — login કરતાં જ app નવો password માંગશે.

નવા user ઉમેરવા: Admin થી login → **👥 User Master**.

---

## Files

```
index.html              આખું UI
css/app.css             styling
js/auth.js              SHA-256, login, roles, user store
js/seed-users.js        શરૂઆતના users (ફક્ત hash, plaintext નહીં)
js/sync.js              offline queue + Supabase sync
js/app.js               jangad, masters, payment, reports
sw.js                   service worker — offline માં app ખૂલે
manifest.json           PWA (phone માં install થાય)
supabase_schema.sql     database schema + RLS
android/                Android APK ની source + build script
DEPLOY.md               hosting અને APK ની પૂરી guide
CREDENTIALS.txt         login list (git માં જતી નથી)
```

---

## Security — પ્રામાણિક વાત

આ app **client-side** છે. Role gating એ નક્કી કરે છે કે user ને શું **દેખાય** અને
શું **કરી શકે** — પણ કોઈ ટેકનિકલ માણસ browser ના DevTools થી એ gating આસપાસ ફરી શકે.

એટલે:

- **ખરી સુરક્ષા Supabase ની RLS policies થી આવે છે**, app ના JavaScript થી નહીં.
  `supabase_schema.sql` ના છેલ્લા ભાગમાં આ સમજાવ્યું છે.
- Site public link પર છે, એટલે `anon key` પણ public છે. એ Supabase નું normal design છે —
  રક્ષણ RLS કરે છે, key છુપાવવાથી નહીં.
- વધુ કડક જોઈએ તો Supabase **Auth** વાપરો અને policies માં `auth.uid()` ચેક કરો.
- `service_role` key ક્યારેય app માં ન નાખવી.

નાની ટીમ માટે, private link + પોતાના password + બદલાયેલા default — આ પૂરતું છે.
