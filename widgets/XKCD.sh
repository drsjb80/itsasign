#! /usr/bin/env bash

# Drop this into your crontab to get the latest XKCD comic every day
# 0 7 * * * src/itsasign/widgets/XKCD.sh >> src/itsasign/xkcd-cron.log 2>&1

# set -x

URL=$(curl -s "https://xkcd.com/info.0.json" | \
        sed -e 's/^.*"img": "//' \
            -e 's/", .*$//')

cd ~/src/itsasign

curl -so XKCD.png ${URL}
