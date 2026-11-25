#!/usr/bin/env bash
# Droplet user data: fetch the repository and hand over to setup.sh, so the
# real setup logic is versioned in git (a rebuild always runs the latest).
set -euxo pipefail
export ADMIN_EMAIL="__ADMIN_EMAIL__"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y git
git clone https://github.com/Janani-asokan/Corpus365.git /opt/corpus365
bash /opt/corpus365/deploy/droplet/setup.sh
