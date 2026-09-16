# Mobile Integration

This combined project keeps the existing SuccessSolarApplication backend and React web frontend as the source of truth and adds the React Native/Expo field employee application under `mobile/`.

## Safety rules
- Do not replace the existing `backend/` or `frontend/` with the mobile project's duplicate copies.
- Do not copy `node_modules`, Python virtual environments, build output, or Git history.
- Keep the existing PostgreSQL database and Alembic history.
- The mobile app must use the existing FastAPI backend and JWT authentication.
- Any backend changes required by mobile must be reviewed and added as separate, compatible changes/migrations; do not overwrite existing backend files wholesale.

## Run mobile

```bash
cd mobile
npm install
cp .env.example .env
# Set API_BASE_URL and WS_BASE_URL for the existing backend
npx expo start --dev-client
```

The mobile application is isolated from the React web application's `frontend/` directory so the existing web app is not overwritten.

## Important
The mobile project contains its own backend/API documentation describing some optional endpoints/features that may not yet exist in the base backend. Those should be implemented only after comparing the current backend and verifying the required contract.
