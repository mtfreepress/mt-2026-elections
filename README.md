# Montana 2026 Elections

Code for the [Montana Free Press](https://montanafreepress.org) [2026 Election Guide](https://projects.montanafreepress.org/election-guide-2026/).

This is a [Next.js](https://nextjs.org/) project.

## Local Deployment
- To access the webservice locally run `npm run dev` and navigate to `localhost:3000/election-guide-2026/`
- Set in `DistrictFinder.js` to use AWS CORS proxy deployment 
- Can use [CORS proxy](https://github.com/mtfreepress/cors-proxy-montana-districts) locally
    
    1) Change `BASE_URL` to `localhost:3000` (Don't forget to change it back)
    2) Start the CORS proxy service ***first***
    3) Start this service with `npm run dev` as normal (will start on port 3001 instead) and navigate to  `localhost:3001/election-guide-2026/`

## Structure

- `input` - Data pipelines for gathering structured information for the guide
- `process` - Data processing code that bundles inputs into data for display
- `src` - Code for Next.js-based static web app using processsed data (page templates, components, styling, etc.)
- `public` - Images and other static content

## Helpful Commands

- To update all YAML files (so the page updates) run `./update-data.sh` in the command line. 

    #### - This will run:

        
        # Data pipline updates
        node inputs/fec/fetch.js
        node inputs/coverage/fetch.js
        node process/legislative-candidates.js
        node process/main.js
        node process/make-candidate-list.js

- To update, build and deploy to AWS, run `./build-and-update.sh` in the command line. 

    #### - This will run:

            
            #!/bin/sh
            # Set Node version
            # export NVM_DIR=$HOME/.nvm;
            # source $NVM_DIR/nvm.sh;
            # nvm use --lts # Use latest Node.js version

            # Data pipeline updates
            node inputs/fec/fetch.js
            node inputs/coverage/fetch.js

            node process/legislative-candidates.js
            node process/main.js
            node process/make-candidate-list.js

            # Build
            npm run build

            # Deploy
            aws s3 sync build s3://projects.montanafreepress.org/election-guide-2026 --delete
            aws cloudfront create-invalidation --distribution-id E3LVPS3XLJHLL5 --paths "/election-guide-2026/*"