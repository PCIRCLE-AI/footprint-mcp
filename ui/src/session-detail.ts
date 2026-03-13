import { App } from "@modelcontextprotocol/ext-apps";
import { initPageI18n } from "./i18n";
import { bootSessionDetail } from "./session-detail-view";

const app = new App({
  name: "Footprint Session Detail",
  version: "1.0.0",
});

initPageI18n();
bootSessionDetail(app);
