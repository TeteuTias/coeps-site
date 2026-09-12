import MetaPurchaseTracker from './MetaPurchaseTracker';

const DEFAULT_PAYMENT_EDITION_ID = 'CIEPS-2026';

export default function SuaInscricaoFoiConfirmadaLayout({ children }) {
  const editionId = process.env.PAYMENT_EDITION_ID?.trim() || DEFAULT_PAYMENT_EDITION_ID;

  return (
    <>
      <MetaPurchaseTracker editionId={editionId} />
      {children}
    </>
  );
}
