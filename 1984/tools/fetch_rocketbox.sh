#!/bin/sh
# Sparse checkout of just the Rocketbox avatars and animations the game uses.
#   sh tools/fetch_rocketbox.sh <dir>
set -e
DIR=${1:-rocketbox}
if [ ! -d "$DIR/.git" ]; then
  GIT_LFS_SKIP_SMUDGE=1 git clone -q --depth 1 --filter=blob:none --no-checkout https://github.com/microsoft/Microsoft-Rocketbox "$DIR"
fi
cd "$DIR"
git sparse-checkout init --no-cone
{
  echo /LICENSE.md
  for a in Professions/Construction_Male_02 Professions/Construction_Male_05 Professions/Construction_Male_06 \
           Professions/Construction_Male_03 Professions/Construction_Male_04 Professions/Business_Female_01 \
           Professions/Business_Female_04 Professions/Business_Male_03 Professions/Police_Male_03 \
           Professions/Security_Male_01 Professions/Gardener_Male_01 Adults/Female_Adult_11 Adults/Male_Adult_03 \
           Children/Male_Child_01; do
    n=$(basename $a)
    echo "/Assets/Avatars/$a/Export/$n.fbx"
    echo "/Assets/Avatars/$a/Textures/"
  done
  for f in static/m_idle_neutral_01 static/f_idle_neutral_01 xy/m_walk_neutral xy/f_walk_neutral_01 xy/m_run_neutral \
           xy/f_run_neutral static/m_sit_chair_idle_neutral_01 static/f_sit_chair_idle_neutral_01 static/m_cheer_01 \
           static/f_cheer_01 static/m_gestic_talk_neutral_01 static/f_gestic_talk_neutral_01 static/m_crouch_idle \
           static/f_crouch_idle static/m_idle_look_around_01 static/f_idle_look_around_01; do
    echo "/Assets/Animations/all_animations_max_motextr_$f.max.fbx"
  done
} > .git/info/sparse-checkout
git checkout -q HEAD
