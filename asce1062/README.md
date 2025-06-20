# [Website](https://alexmbugua.me/)

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

1. Run Pre-deploy script to sanitize `/dist`.

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
- `predeploy` script modifies `/dist` output for `gh-pages jekyll sites`
  - Runs `scripts/pre-deploy.js` which removes underscores and fixes paths
  - Jekyll "ignores" directories/files with underscores [Issue #55](https://github.com/jekyll/jekyll/issues/55). This is a feature not a bug (they are treated as "special")
    - Adding a `.nojekyll` does not [bypass Jekyll on GitHub pages](https://github.blog/news-insights/bypassing-jekyll-on-github-pages/) for us
  - Creates a CNAME record pointing our branch deploy to our apex custom domain `alexmbugua.me`
    - _CNAME record for `www` in the apex domain provider should point to `<username>.github.io`_
- `deploy` script will:
  - Run `predeploy` script
  - Push to a branch of choice, `alexmbugua`, triggering automatic deploys
