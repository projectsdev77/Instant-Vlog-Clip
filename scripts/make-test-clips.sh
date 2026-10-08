#!/usr/bin/env bash
# Generates small test videos (vertical + horizontal, with/without audio) for e2e tests.
# Defaults to VP9/WebM because Playwright's Chromium has no H.264 decoder; CODEC=h264 for MP4.
set -euo pipefail
OUT=${1:-e2e/fixtures}
mkdir -p "$OUT"
gen() { # name size duration videosrc audiosrc(optional) codec
  local name=$1 size=$2 dur=$3 vsrc=$4 asrc=${5:-} codec=${6:-${CODEC:-vp9}}
  local args=(-y -loglevel error -f lavfi -i "$vsrc=size=$size:rate=30:duration=$dur")
  [[ -n $asrc ]] && args+=(-f lavfi -i "$asrc:duration=$dur")
  if [[ $codec == vp9 ]]; then
    args+=(-c:v libvpx-vp9 -b:v 600k -deadline realtime -cpu-used 8)
    [[ -n $asrc ]] && args+=(-c:a libopus)
    ext=webm
  else
    args+=(-c:v libx264 -preset ultrafast -pix_fmt yuv420p -profile:v high)
    [[ -n $asrc ]] && args+=(-c:a aac)
    ext=mp4
  fi
  ffmpeg "${args[@]}" -shortest "$OUT/$name.$ext"
}
gen coffee-closeup 720x1280 6 testsrc2 "sine=frequency=220"
gen park-bike-pov 720x1280 8 testsrc
gen talking-selfie 720x1280 7 rgbtestsrc "anoisesrc=color=pink:amplitude=0.3"
gen street-wide 1280x720 9 smptehdbars "sine=frequency=440"
gen sunset 720x1280 5 smptebars
gen park-bike-pov-again 720x1280 8 testsrc
echo "Wrote clips to $OUT"
