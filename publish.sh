#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  Mudra Diamond — one-command publish
#
#  GitHub account અને repo બનાવ્યા પછી આ ચલાવો:
#
#      ./publish.sh YOUR-GITHUB-USERNAME
#
#  આ script:
#    1. તમારી GitHub Pages URL નક્કી કરે છે
#    2. એ URL સાથે APK ફરી build કરે છે
#    3. APK અને docs update કરે છે
#    4. GitHub પર push કરે છે
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

USER_NAME="${1:-}"
REPO="${2:-mudra-diamond}"

if [ -z "$USER_NAME" ]; then
  echo "વાપરવાની રીત:  ./publish.sh YOUR-GITHUB-USERNAME [repo-name]"
  echo "દા.ત.:        ./publish.sh rakeshmakani"
  exit 1
fi

URL="https://${USER_NAME}.github.io/${REPO}/"

echo "=========================================="
echo " Username : $USER_NAME"
echo " Repo     : $REPO"
echo " Live URL : $URL"
echo "=========================================="
echo ""

# 1 -------------------------------------------------- bake URL into the APK ---
echo "==> [1/4] APK માં URL set કરું છું"
python - "$URL" <<'PY'
import sys, io, re
url = sys.argv[1]
p = 'android/app.properties'
s = io.open(p, encoding='utf-8').read()
s = re.sub(r'(?m)^mudraUrl=.*$', 'mudraUrl=' + url, s)
io.open(p, 'w', encoding='utf-8').write(s)
print('    android/app.properties -> ' + url)
PY

# 2 ------------------------------------------------------------ rebuild APK ---
echo "==> [2/4] APK build કરું છું"
( cd android && ./build-apk.sh )

# 3 ----------------------------------------------------- put the URL in docs ---
echo "==> [3/4] Docs update કરું છું"
python - "$USER_NAME" "$REPO" <<'PY'
import sys, io
user, repo = sys.argv[1], sys.argv[2]
for p in ('DEPLOY.md', 'README.md'):
    s = io.open(p, encoding='utf-8').read()
    s = s.replace('YOUR-USERNAME', user)
    s = s.replace('<તમારું-github-username>', user)
    s = s.replace('mudra-diamond.git', repo + '.git')
    io.open(p, 'w', encoding='utf-8').write(s)
print('    DEPLOY.md, README.md updated')
PY

# 4 ------------------------------------------------------------------- push ---
echo "==> [4/4] GitHub પર push"
git add -A
git add -f "android/MudraDiamond-5.1.1.apk"
git -c user.name="$USER_NAME" -c user.email="rcmakani@gmail.com" \
    commit -q -m "publish: point the app and APK at $URL" || echo "    (કંઈ નવું નથી)"

if git remote | grep -qx origin; then
  git remote set-url origin "https://github.com/${USER_NAME}/${REPO}.git"
else
  git remote add origin "https://github.com/${USER_NAME}/${REPO}.git"
fi
git branch -M main
git push -u origin main

echo ""
echo "=============================================================="
echo " ✅ Push થઈ ગયું."
echo ""
echo " હવે GitHub પર એક વાર Pages ચાલુ કરો:"
echo "   github.com/${USER_NAME}/${REPO}  ->  Settings  ->  Pages"
echo "   Source: Deploy from a branch | Branch: main | Folder: / (root)"
echo ""
echo " 1-2 મિનિટ પછી તમારી કાયમી link:"
echo "   $URL"
echo ""
echo " APK download link:"
echo "   ${URL}android/MudraDiamond-5.1.1.apk"
echo "=============================================================="
