
## LXD Attendance — corrected server bundle

- Cohort duration is no longer supplied by the client. The service calculates and stores `durationMonths` from the selected start/end dates.
- Invalid date ranges are rejected before persistence.
- GraphQL DTO fields use definite assignment where required by strict TypeScript settings.
- The server project is kept separate from the Next.js client project.

### Local run

```bash
npm install
npx prisma generate
npm run build
npm run start:dev
```
