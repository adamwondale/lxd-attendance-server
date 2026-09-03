# LXD Attendance — correction notes

- Student portal registration now validates the selected cohort/session/PIN and creates the tenant student role + cohort membership in one transaction.
- Legacy single-company phone/password portal accounts are repaired into the tenant roster automatically.
- Cohort duration is no longer selected manually; it is calculated from start/end dates and stored in `durationMonths`.
- First-time `/admin/login` shows the company-profile setup entry when no company exists.
- Student/Admin login cross-links were removed from the shared login shell.
- Fixed the missing `ArrowLeft` import on cohort details and kept the attendance `Table` import explicit.
- Attendance and report tables use pagination; cohort session lists are paginated as well.
- CSV attendance export was replaced with styled Excel-compatible export and a print-to-PDF flow.
- Responsive spacing/cards, rounded controls, hover lift, smooth scrolling, focus states and reduced-motion support were added.
- TypeScript build errors are no longer silently ignored in Next.js.
