# [Website](https://alexmbugua.me/) [![Netlify Status](https://api.netlify.com/api/v1/badges/e4a4138b-ce8f-454c-8d78-0ee4f68631d4/deploy-status)](https://app.netlify.com/projects/alexmbugua/deploys)

![Website](https://raw.githubusercontent.com/asce1062/asce1062/refs/heads/main/asce1062/public/alexmbugua.me.png)

- Personal site/portfolio/blog.
- Built with [Astro](https://astro.build/) and [TailwindCSS](https://tailwindcss.com/).
- Dark and light modes with a responsive, mobile-friendly design.

## Development

1. Clone the source code to your device

```sh
git clone git@github.com:asce1062/asce1062.git
```

or

```sh
git clone https://github.com/asce1062/asce1062.git
```

2. Navigate to working directory

```sh
cd asce1062/asce1062
```

3. Install the project's dependencies.

```sh
npm install
```

4. Start the development server on `localhost:4321`

```sh
npm run dev
```

5. Build the site to `/dist`.

```sh
npm run build
```

### Deploying to Github Pages (Deploy from a branch)

1. Run Pre-deploy script.

```sh
npm run predeploy
```

2. Start `/dist` preview server on `localhost:4322`

```sh
npm run preview
```

3. Run deploy script.

```sh
npm run deploy
```

#### Notes

- Built on node 24
- `/dist` output from step #5 `npm run build` can be deployed using workflows, or to any other platform that can host static files
- For github branch deploys
  - Jekyll "ignores" directories/files with underscores [Issue #55](https://github.com/jekyll/jekyll/issues/55). This is a feature not a bug (they are treated as "special")

  - Adding a `.nojekyll` does not [bypass Jekyll on GitHub pages](https://github.blog/news-insights/bypassing-jekyll-on-github-pages/) for us

  - To address this we tell Astro to build out our assets in a directory without a leading underscore
    - in our `astro.config.mjs`

      ```javascript
        build: {
          assets: 'astro'
        },
      ```

- We use a [gh-pages](https://www.npmjs.com/package/gh-pages) integration in our `deploy` script, `gh-pages -d dist --branch alexmbugua --nojekyll --cname alexmbugua.me --dotfiles`, that does a couple of things for us:
  1. `-d dist` tells `gh-pages` to deploy the contents of the dist folder. This is the output directory from our Astro build
  2. `--branch alexmbugua` deploys to my custom branch named `alexmbugua` instead of the default `gh-pages` branch.
  3. `--nojekyll` creates a `.nojekyll` file that disables GitHub Pages' built-in Jekyll processing on branch deploys.
  4. `--cname alexmbugua.me` creates a file named `CNAME` in the root of the deployed branch with the content:

     ```cname
     alexmbugua.me
     ```

     - This tells `github-pages` to map the site to my custom domain [alexmbugua.me](https://alexmbugua.me/).
     - _CNAME record for `www` in the apex domain provider should point to `<username>.github.io`_

  5. `--dotfiles` tells `gh-pages` to include hidden files (dotfiles) in the deployment.
