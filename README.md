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

Standalone build:
- Run `yarn build`

Development - run it and stop it with Ctrl+C when you want to exit:
- Run `yarn start`
- Load the `dist/` directory to your browser

# Install
## Load the extension locally (unpacked)
- Open Chrome and go to chrome://extensions
- Turn on Developer mode (toggle, top-right)
- Click “Load unpacked”
- Select the dist folder
