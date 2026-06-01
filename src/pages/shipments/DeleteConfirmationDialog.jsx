export default function DeleteConfirmationDialog({ row, saving, message, onCancel, onConfirm }) {
  const title = `Delete shipment ${row?.bookingNo || row?.recordId}?`;
  return (
    <div className="shipment-confirm">
      <div className="shipment-confirm-backdrop" aria-hidden="true" />
      <div
        className="shipment-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shipment-confirm-title"
      >
        <div className="top-title" id="shipment-confirm-title">{title}</div>
        <p className="shipment-confirm-copy">
          This action will remove the shipment from the active list.
        </p>
        {message ? <div className="inline-error shipment-confirm-message">{message}</div> : null}
        <div className="shipment-confirm-actions">
          <button className="btn" type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-danger" type="button" onClick={onConfirm} disabled={saving}>
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
}
