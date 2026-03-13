import { initPageI18n } from "./i18n";
import { bootSessionDashboard } from "./session-dashboard-view";
import { createDashboardLiveDemoApp } from "./live-demo-client";

initPageI18n();
bootSessionDashboard(createDashboardLiveDemoApp());
