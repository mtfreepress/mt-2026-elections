#!/bin/sh
# Set Node version
# export NVM_DIR=$HOME/.nvm;
# source $NVM_DIR/nvm.sh;
# nvm use --lts # Use latest Node.js version

# Data pipeline updates
node inputs/fec/fetch.js # FEC data
node inputs/coverage/fetch.js # MTFP coverage data
node inputs/filings/fetch.js # MT SoS candidate filings

# Process and combine data
node process/legislative-candidates.js
node process/main.js
node process/make-candidate-list.js