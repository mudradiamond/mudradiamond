/* Default cloud connection for this deployment.
   Left blank in the repository on purpose — the Supabase key is NOT committed.
   The GitHub Actions deploy (.github/workflows/deploy.yml) rewrites this file
   from repository secrets, so the published site carries the values and every
   phone connects on its own with nothing to type in.

   Blank values simply mean "no default": the app then falls back to the
   "Cloud જોડો" button on the login screen. */
const CLOUD_DEFAULTS = {
  url: "",
  key: "",
  company: "Mudra Diamond"
};
