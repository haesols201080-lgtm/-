#!/bin/sh
# The data blender/build_person.py builds the stranger from (all CC0; none of it is committed, and nothing in it is
# run: the builder only reads it):
#   mpfb/    MPFB2's data folder (the base mesh, its shape and expression targets, the game-engine rig and weights),
#            at the commit he was built from
#   eyes/    MakeHuman's eyes (the high-poly mesh, its fitting, the iris texture), likewise
#   assets/  MakeHuman's system assets he wears: the skin photo, short02 hair, eyebrow001, eyelashes01, and the two
#            outfits (male_casualsuit05: field jacket and jeans; male_casualsuit06: T-shirt and jeans)
# (his boots are Poly Haven's rubber_boots, already in public/models/house)
# usage: sh blender/fetch_person_data.sh [out dir, default ./person_data]
#        then: blender's python -I blender/build_person.py <out dir> --export stranger.glb --save character.blend
set -e
OUT=${1:-person_data}
mkdir -p "$OUT/src" "$OUT/assets"
sparse() {   # repo url, commit, folder, checkout dir
  if [ ! -d "$4/.git" ]; then git clone -q --filter=blob:none --no-checkout "$1" "$4"; fi
  git -C "$4" sparse-checkout set "$3" && git -C "$4" checkout -q "$2"
}
sparse https://github.com/makehumancommunity/mpfb2.git d9648f3257a0b9712281d466245f30d656250154 src/mpfb/data "$OUT/src/mpfb2"
sparse https://github.com/makehumancommunity/makehuman.git a8bc2d54ff0ac92e78ff71431b1023eda42bf482 makehuman/data/eyes "$OUT/src/makehuman"
ln -sfn src/mpfb2/src/mpfb/data "$OUT/mpfb"
ln -sfn src/makehuman/makehuman/data/eyes "$OUT/eyes"
RAW=https://raw.githubusercontent.com/vidya-hub/makehuman-core/HEAD/data
get() { mkdir -p "$OUT/assets/$(dirname "$2")"; curl -fsSL --retry 3 -o "$OUT/assets/$2" "$RAW/$1"; }
get skins/middleage_caucasian_male/middleage_lightskinned_male_diffuse.png skins/middleage_lightskinned_male_diffuse.png
for f in short02.mhclo short02.mhmat short02.obj short02_diffuse.png; do get hair/short02/$f hair/short02/$f; done
for f in eyebrow001.mhclo eyebrow001.mhmat eyebrow001.obj eyebrow001.png; do get eyebrows/eyebrow001/$f eyebrows/eyebrow001/$f; done
for f in eyelashes01.mhclo eyelashes01.mhmat eyelashes01.obj eyelashes01.png; do get eyelashes/eyelashes01/$f eyelashes/eyelashes01/$f; done
for s in male_casualsuit05 male_casualsuit06; do
  for f in $s.mhclo $s.mhmat $s.obj ${s}_diffuse.png ${s}_normal.png; do get clothes/$s/$f clothes/$s/$f; done
done
echo "person data in $OUT"
