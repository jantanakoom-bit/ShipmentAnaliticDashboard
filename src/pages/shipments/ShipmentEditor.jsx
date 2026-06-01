import { STATUS_OPTIONS } from "./shipmentTableModel";

export default function ShipmentEditor({
  mode,
  form,
  row,
  titleId,
  canViewAll,
  saving,
  onChange,
  onCreate,
  onUpdate,
  onDelete,
  onClose,
}) {
  const isCreate = mode === "create";
  return (
    <section className="shipment-editor" aria-label="Shipment editor">
      <div className="admin-head">
        <div>
          <div className="top-title" id={titleId}>{isCreate ? "Add Shipment" : `Shipment Detail: ${row?.bookingNo || row?.recordId}`}</div>
          <div className="chart-sub">{isCreate ? "Create a record owned by the current session" : "Review and update shipment fields"}</div>
        </div>
        <button className="btn" type="button" onClick={onClose}>Close</button>
      </div>
      <form className="shipment-form" onSubmit={isCreate ? onCreate : onUpdate}>
        <ShipmentInput label="Date" value={form.date} onChange={(value) => onChange("date", value)} type="date" />
        <ShipmentInput label="Booking No" value={form.bookingNo} onChange={(value) => onChange("bookingNo", value)} />
        <ShipmentInput label="Job No" value={form.jobNo} onChange={(value) => onChange("jobNo", value)} />
        <ShipmentInput label="Shipper" value={form.shipper} onChange={(value) => onChange("shipper", value)} />
        <ShipmentInput label="Port" value={form.port} onChange={(value) => onChange("port", value)} />
        <ShipmentInput label="Country" value={form.country} onChange={(value) => onChange("country", value)} />
        <ShipmentInput label="Trade" value={form.trade} onChange={(value) => onChange("trade", value)} />
        <ShipmentInput label="Carrier" value={form.carrier} onChange={(value) => onChange("carrier", value)} />
        <ShipmentInput label="Sale Name" value={form.saleName} onChange={(value) => onChange("saleName", value)} />
        <ShipmentInput label="Qty" value={form.qty} onChange={(value) => onChange("qty", value)} type="number" />
        <ShipmentInput label="Unit" value={form.unit} onChange={(value) => onChange("unit", value)} />
        <ShipmentInput label="TEU" value={form.teu} onChange={(value) => onChange("teu", value)} type="number" />
        <label className="form-group">
          <span className="form-label">Status</span>
          <select className="form-select" value={form.status} onChange={(event) => onChange("status", event.target.value)}>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
        {canViewAll ? (
          <>
            <ShipmentInput label="Owner user id" value={form.ownerUserId} onChange={(value) => onChange("ownerUserId", value)} />
            <ShipmentInput label="Owner username" value={form.ownerUsername} onChange={(value) => onChange("ownerUsername", value)} />
          </>
        ) : null}
        <div className="shipment-form-actions">
          <button className="btn btn-primary" type="submit" disabled={saving || (!isCreate && !row?.recordId)}>
            {isCreate ? "Create Shipment" : "Save Changes"}
          </button>
          {!isCreate ? (
            <button className="btn btn-danger" type="button" disabled={saving || !row?.recordId} onClick={onDelete}>
              Delete Shipment
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function ShipmentInput({ label, value, onChange, type = "text" }) {
  return (
    <label className="form-group">
      <span className="form-label">{label}</span>
      <input
        className="form-input"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
