#!/bin/sh
# Set Node version
# export NVM_DIR=$HOME/.nvm;
# source $NVM_DIR/nvm.sh;
# nvm use --lts # Use latest Node.js version

# Data pipeline updates
node inputs/fec/fetch.js
node inputs/coverage/fetch.js
node inputs/filings/fetch.js

# Process and combine data
node process/legislative-candidates.js
node process/main.js
node process/make-candidate-list.js

# Build
npm run build

# Deploy
aws s3 sync build s3://projects.montanafreepress.org/election-guide-2026 --delete
aws cloudfront create-invalidation --distribution-id E1G7ISX2SZFY34 --paths "/election-guide-2026/*"