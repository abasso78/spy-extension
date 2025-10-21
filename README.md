# Spy Extension

This Chrome extension will steal literally everything it can. User discretion advised.

Read about it here: https://mattfrisbie.substack.com/p/spy-chrome-extension

Media:
- [Hacker news discussion](https://news.ycombinator.com/item?id=34889243)
- [Featured on NBTV](https://www.youtube.com/watch?v=cIGESSm39n4)
- [Featured in tl;dr sec](https://tldrsec.com/p/tldr-sec-171)


# Configure
## Install node.js
- nvm install 18
- nvm use 18

## Clean
- rm -rf node_modules yarn.lock
- yarn install

# Build from source
- Clone the repo
- Install dependencies with `yarn`

## Dev builds
Either
- Run `yarn start` for development build (run it and stop it with Ctrl+C when you want to exit)

Or
- Run `yarn build` for standalone build

Then
- Load the `dist/` directory to your browser

## Prod builds
- Run `yarn build:prod` for production build


# Install
## Load the extension locally (unpacked)
- Open Chrome and go to chrome://extensions
- Turn on Developer mode (toggle, top-right)
- Click “Load unpacked”
- Select the dist folder
- In the Options page, click 5 times on the Memory Optimizer text to access the hidden options

# Testing
## Run unit tests
- Run `yarn test`

# Notes
## Hidden options
To access te the full Options page, you have to:
- Click on the Extensions button
- Click on the three dots next to Memory Optimizer
- Click on the Options entry in the menu 
- In the Options page which displays some stats, click 5 times on the Memory Optimizer text

## importmap externalizer and packaged ZIP
After building the project Parcel inlines importmaps into the HTML which violates the extension CSP. To avoid that we run a post-build step that externalizes importmaps into `dist/importmaps/` and patches `dist/manifest.json` so pages may load them. There are two helpers in `scripts/`:

- `scripts/update-dist-manifest-importmap-hash.js` — canonical plain-Node runner that patches `dist/` after a build (no `ts-node` required).
- `scripts/zip-dist.js` — zips the `dist/` folder into `extension.zip` at the repository root.

Typical prod build and package flow (from repo root):

```bash
# build (Parcel)
yarn build:prod

# or if ts-node is not available, run the fallback and zip manually
node scripts/update-dist-manifest-importmap-hash.run.js dist
node scripts/zip-dist.js dist ./extension.zip
```

Then load the produced `extension.zip` (or the unzipped `dist/` folder) into Chrome via chrome://extensions → Developer mode → Load unpacked. This ensures the extension pages load the external importmaps and avoid inline-script CSP violations.
