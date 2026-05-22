import app from "./app";
import { ENV } from "./config/env";
import { RELEASE } from "./config/release";
import { startInternalJobsIfEnabled } from "./jobs/internalJobs";

app.listen(ENV.PORT, () => {
  console.log(
    `[server] Cheque-Inn API v${RELEASE.version} (${RELEASE.phase}) listening on port ${ENV.PORT} (${ENV.NODE_ENV}) trust_proxy=${ENV.TRUST_PROXY}`
  );
  startInternalJobsIfEnabled();
});
