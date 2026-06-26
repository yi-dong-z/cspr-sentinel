#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS="$ROOT/docs/demo-assets"
OUT="$ROOT/docs/cspr-sentinel-demo.mp4"

TITLE_TMP="$(mktemp -d "${TMPDIR:-/tmp}/cspr-sentinel-title.XXXXXX")"
cleanup() {
  rm -rf "$TITLE_TMP"
  rm -f "$ASSETS/title.png" "$ASSETS/narration.aiff"
}
trap cleanup EXIT

qlmanage -t -s 1280 -o "$TITLE_TMP" "$ASSETS/title.svg" >/dev/null
cp "$TITLE_TMP/title.svg.png" "$ASSETS/title.png"
say -v Samantha -r 175 -f "$ASSETS/narration.txt" -o "$ASSETS/narration.aiff"

ffmpeg -y \
  -loop 1 -t 6 -i "$ASSETS/title.png" \
  -loop 1 -t 14 -i "$ASSETS/01-dashboard.png" \
  -loop 1 -t 16 -i "$ASSETS/02-pending-approval.png" \
  -loop 1 -t 15 -i "$ASSETS/03-delivered-report.png" \
  -loop 1 -t 16 -i "$ASSETS/03-delivered-report.png" \
  -i "$ASSETS/narration.aiff" \
  -filter_complex "\
    [0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720:(in_w-1280)/2:(in_h-720)/2,setsar=1[v0];\
    [1:v]scale=1280:720,setsar=1[v1];\
    [2:v]crop=1280:720:0:560,setsar=1[v2];\
    [3:v]crop=1280:720:0:210,setsar=1[v3];\
    [4:v]crop=1280:720:0:1080,setsar=1[v4];\
    [v0][v1][v2][v3][v4]concat=n=5:v=1:a=0,format=yuv420p[v]" \
  -map "[v]" -map 5:a \
  -c:v libx264 -preset medium -crf 20 -r 30 \
  -c:a aac -b:a 160k -shortest -movflags +faststart "$OUT"
echo "$OUT"
