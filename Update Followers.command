#!/bin/bash
# Reads the follower count from Instagram, updates the site and publishes it.
cd "$(dirname "$0")"
python3 tools/update_followers.py
read -p "Press Enter to close."
