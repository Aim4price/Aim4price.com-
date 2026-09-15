# Report download dialogs

Reference: **Export Asset Map Tracking**. The shared `components/ReportDownload.module.css` supplies the 58rem maximum width, title and card typography, icon tiles, rounded corners, blurred backdrop, divider and footer buttons. Each workflow retains its available formats, filters, permissions and download handlers.

| Dialog | Implementation |
| --- | --- |
| Asset Map export | `app/asset-map/asset-map-client.tsx` |
| Individual asset reports | `app/asset-register/asset-register-client.tsx` |
| Asset Register export | `app/asset-register/asset-register-client.tsx` |
| Multiple Asset Registers and summaries | `app/asset-registers/asset-registers-client.tsx` |
| Cost Ledger download | `app/my-invoices/my-invoices-client.tsx` |
| Maintenance scope | `app/maintenance/maintenance-client.tsx` |
| Maintenance format and timeline | `app/maintenance/maintenance-client.tsx` |
| Fuel Slips download | `app/fuel/fuel-client.tsx` |
| Fuel Ledger export | `app/fuel/fuel-client.tsx` |
| Lead asset reports | `app/leads/leads-client.tsx` |
| Dealer maintenance reports | `components/DealerMaintenanceReportModal.tsx` |
| Dealer cost of ownership | `components/DealerCostOfOwnershipReportModal.tsx` |
| Accountant register reports | `components/AccountantRegisterReportsModal.tsx` |
| Umbrella reports | `components/asset-register/AssetGroupManagerModal.tsx` |
| Owner app report attachments | `app/owner-app/assets/[assetId]/owner-asset-report-picker.tsx` |
| Owner app report filters | `app/owner-app/assets/[assetId]/owner-asset-report-picker.tsx` |
| Spending budgets | `app/budgets/BudgetTracking.tsx` |

Asset selection steps continue to use the shared AssetPicker design. Summary dashboards, document viewers, advert sharing and direct file-download buttons are not report-format dialogs; their existing actions remain intact.

## Verification

`node scripts/verify-report-downloads.cjs` opens the real page clients with fixture API responses. It compares dialog geometry, heading/divider spacing, every option card and icon, selected backgrounds, hover effects, footer button dimensions/typography/colours, and horizontal overflow at 1440px and 430px. Style comparisons use independent original Asset Map markup; backdrop colour and blur are checked against its source values because legacy global overlay CSS affects the unscoped reference in the combined test fixture. It covers 23 report choice, format and timeline/scope flows (46 viewport combinations), including advancing Cost Ledger with Next to reach the actual timeline. The temporary route is removed after the run. Set `REPORT_BROWSER_PATH` when Chromium is supplied externally.

The audit inventory lives in `tests/fixtures/report-download-inventory.json`. The tests use no production records.

The second audit corrected footer colours, shadows and letter spacing, standardized option hover effects, restored the umbrella backdrop against a legacy transparent-overlay rule, and brought the later Asset Register quick-report labels under the shared typography. These are fixture-based browser checks; production deployment and live authenticated download generation are separate checks.
