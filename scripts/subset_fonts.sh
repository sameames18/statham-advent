#!/usr/bin/env bash
# Rebuilds public/fonts/ from the upstream font sources.
#
# Needs fonttools with brotli (pip install fonttools brotli) and curl. All
# four faces are SIL OFL. Fraunces, Berkshire Swash and Reenie Beanie come
# from the originals in the google/fonts repository. Libre Caslon Text comes
# from the files Google Fonts serves (version 1.1, static): the repository
# now holds a 2.0 revision whose italic turns "st" into a long-s ligature by
# default and whose metrics differ slightly, so that would change the look.
# Each face is subset to the Latin range Google Fonts serves as its "latin"
# slice (plus the arrows block) and written as WOFF2. Fraunces stays
# variable with every axis intact so font-variation-settings keep working.
set -euo pipefail
# Pin the head.modified timestamp fonttools writes, so rebuilds are byte-identical.
export SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-0}"

here=$(cd "$(dirname "$0")/.." && pwd)
out="$here/public/fonts"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

base=https://raw.githubusercontent.com/google/fonts/main/ofl
gstatic=https://fonts.gstatic.com/s/librecaslontext/v5
latin='U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2190-2193,U+2212,U+2215,U+FEFF,U+FFFD'

fetch() { curl -sSfL "$1" -o "$work/$2"; }
subset() {
  pyftsubset "$work/$1" --output-file="$out/$2" --flavor=woff2 --unicodes="$latin" \
    --layout-features='*' --name-IDs='*' --notdef-outline "${@:3}"
}

fetch "$base/fraunces/Fraunces%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf" fraunces.ttf
fetch "$base/fraunces/OFL.txt" OFL-Fraunces.txt
fetch "$base/librecaslontext/OFL.txt" OFL-LibreCaslonText.txt
fetch "$base/berkshireswash/BerkshireSwash-Regular.ttf" berkshire.ttf
fetch "$base/berkshireswash/OFL.txt" OFL-BerkshireSwash.txt
fetch "$base/reeniebeanie/ReenieBeanie.ttf" reenie.ttf
fetch "$base/reeniebeanie/OFL.txt" OFL-ReenieBeanie.txt
# The Latin slices from the Google Fonts CSS API, requested with a browser
# user agent on 2026-09-27 for wght 400, 700 and 400 italic.
fetch "$gstatic/DdT878IGsGw1aF1JU10PUbTvNNaDMfq41-JJHRO0.woff2" caslon-400.woff2
fetch "$gstatic/DdT578IGsGw1aF1JU10PUbTvNNaDMfID8vdkPx6esdPs.woff2" caslon-700.woff2
fetch "$gstatic/DdT678IGsGw1aF1JU10PUbTvNNaDMfq95-BDGjG2u9s.woff2" caslon-italic-400.woff2

mkdir -p "$out"
cp "$work"/OFL-*.txt "$out/"

# Fraunces: variable, all axes (opsz 9-144, wght 100-900, SOFT 0-100, WONK 0-1).
# Unhinted, like the variable font Google serves.
subset fraunces.ttf fraunces-latin.woff2 --no-hinting
# Libre Caslon Text: the served statics, already Latin and unhinted; re-subset for consistency.
subset caslon-400.woff2 libre-caslon-text-latin.woff2
subset caslon-700.woff2 libre-caslon-text-bold-latin.woff2
subset caslon-italic-400.woff2 libre-caslon-text-italic-latin.woff2
subset berkshire.ttf berkshire-swash-latin.woff2 --no-hinting
subset reenie.ttf reenie-beanie-latin.woff2 --no-hinting

ls -l "$out"/*.woff2
