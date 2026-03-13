import { initPageI18n } from "./i18n";
import { bootSessionDetail } from "./session-detail-view";
import { createDetailLiveDemoApp } from "./live-demo-client";

initPageI18n();
bootSessionDetail(createDetailLiveDemoApp());
