#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  Mudra Diamond — APK builder
#
#  Builds a signed release APK straight from the Android SDK command-line
#  tools (aapt2 / javac / d8 / zipalign / apksigner). No Gradle, no downloads.
#
#  Usage:   ./build-apk.sh                       # uses URL from app.properties
#           ./build-apk.sh https://my.site/app/  # or pass the URL directly
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/AppData/Local/Android/Sdk}}"
SDK="$(cygpath -u "$SDK" 2>/dev/null || echo "$SDK")"
BT="$SDK/build-tools/34.0.0"
ANDROID_JAR="$SDK/platforms/android-34/android.jar"

APP_ID="com.mudra.diamond"
VERSION_CODE=1
VERSION_NAME="5.0.0"
MIN_SDK=23
TARGET_SDK=34

START_URL="${1:-$(grep -E '^mudraUrl=' app.properties | cut -d= -f2-)}"
[ -n "$START_URL" ] || { echo "ERROR: no start URL"; exit 1; }

[ -d "$BT" ] || { echo "ERROR: build-tools 34.0.0 not found at $BT"; exit 1; }
[ -f "$ANDROID_JAR" ] || { echo "ERROR: android.jar not found at $ANDROID_JAR"; exit 1; }

echo "==> App URL : $START_URL"
echo "==> SDK     : $SDK"

OUT=build
rm -rf "$OUT"
mkdir -p "$OUT/res" "$OUT/gen" "$OUT/classes" "$OUT/dex"

# 1 ---------------------------------------------------------- compile res ---
echo "==> [1/7] compiling resources"
"$BT/aapt2.exe" compile --dir app/src/main/res -o "$OUT/res/resources.zip"

# 2 ------------------------------------------------------------- link res ---
echo "==> [2/7] linking resources"
"$BT/aapt2.exe" link \
  -o "$OUT/base.apk" \
  -I "$ANDROID_JAR" \
  --manifest app/src/main/AndroidManifest.xml \
  --java "$OUT/gen" \
  --min-sdk-version "$MIN_SDK" \
  --target-sdk-version "$TARGET_SDK" \
  --version-code "$VERSION_CODE" \
  --version-name "$VERSION_NAME" \
  --auto-add-overlay \
  "$OUT/res/resources.zip"

# 3 ----------------------------------------------------------- BuildConfig ---
echo "==> [3/7] generating BuildConfig"
mkdir -p "$OUT/gen/com/mudra/diamond"
cat > "$OUT/gen/com/mudra/diamond/BuildConfig.java" <<EOF
package com.mudra.diamond;
public final class BuildConfig {
  public static final boolean DEBUG = false;
  public static final String APPLICATION_ID = "$APP_ID";
  public static final String BUILD_TYPE = "release";
  public static final int VERSION_CODE = $VERSION_CODE;
  public static final String VERSION_NAME = "$VERSION_NAME";
  public static final String START_URL = "$START_URL";
}
EOF

# 4 ---------------------------------------------------------------- javac ---
echo "==> [4/7] compiling java"
find app/src/main/java "$OUT/gen" -name '*.java' > "$OUT/sources.txt"
javac -nowarn -encoding UTF-8 --release 11 \
      -cp "$(cygpath -w "$ANDROID_JAR")" \
      -d "$OUT/classes" \
      @"$OUT/sources.txt"

# 5 ------------------------------------------------------------------- d8 ---
echo "==> [5/7] dexing"
find "$OUT/classes" -name '*.class' > "$OUT/classes.txt"
# d8.bat / apksigner.bat break on SDK paths containing spaces, so call the jars
java -cp "$(cygpath -w "$BT/lib/d8.jar")" com.android.tools.r8.D8 \
     --release --min-api "$MIN_SDK" \
     --lib "$(cygpath -w "$ANDROID_JAR")" \
     --output "$(cygpath -w "$OUT/dex")" \
     @"$OUT/classes.txt"

# 6 ------------------------------------------------- pack dex + zipalign ---
echo "==> [6/7] packaging"
cp "$OUT/base.apk" "$OUT/unsigned.apk"
python - "$OUT/unsigned.apk" "$OUT/dex/classes.dex" <<'PY'
import sys, zipfile, shutil, os
apk, dex = sys.argv[1], sys.argv[2]
tmp = apk + ".tmp"
with zipfile.ZipFile(apk) as zin, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
    for it in zin.infolist():
        if it.filename != 'classes.dex':
            zout.writestr(it, zin.read(it.filename))
    zout.write(dex, 'classes.dex')
shutil.move(tmp, apk)
print("    classes.dex added (%d bytes)" % os.path.getsize(dex))
PY
"$BT/zipalign.exe" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

# 7 ----------------------------------------------------------------- sign ---
echo "==> [7/7] signing"
if [ ! -f signing.properties ]; then
  echo "ERROR: signing.properties missing — cannot sign."
  exit 1
fi
KS=$(grep    -E '^storeFile='     signing.properties | cut -d= -f2-)
KSPW=$(grep  -E '^storePassword=' signing.properties | cut -d= -f2-)
ALIAS=$(grep -E '^keyAlias='      signing.properties | cut -d= -f2-)
KPW=$(grep   -E '^keyPassword='   signing.properties | cut -d= -f2-)

APK="MudraDiamond-${VERSION_NAME}.apk"
java -jar "$(cygpath -w "$BT/lib/apksigner.jar")" sign \
  --ks "$KS" --ks-pass "pass:$KSPW" \
  --ks-key-alias "$ALIAS" --key-pass "pass:$KPW" \
  --v1-signing-enabled true --v2-signing-enabled true \
  --out "$APK" "$OUT/aligned.apk"

java -jar "$(cygpath -w "$BT/lib/apksigner.jar")" verify --print-certs "$APK" | head -4

echo ""
echo "=============================================="
echo " APK ready: android/$APK"
echo " Size     : $(du -h "$APK" | cut -f1)"
echo " Opens    : $START_URL"
echo "=============================================="
