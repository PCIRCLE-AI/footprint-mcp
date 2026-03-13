import { App } from "@modelcontextprotocol/ext-apps";
import { initPageI18n } from "./i18n";
import { bootSessionDashboard } from "./session-dashboard-view";

const app = new App({
  name: "Footprint Session Dashboard",
  version: "1.0.0",
});

initPageI18n();
bootSessionDashboard(app);
