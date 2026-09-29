export function renderUserSection(selectedDataItem, schema) {
  if (!selectedDataItem || schema?.engineKey !== "presence") return null;

  return (
    <div key="presence-user-section" className="section">
      <h3>User</h3>
       <div
      className="inline-row"
    >
      <span className="label-container">User Name: </span>
      <span className="value-container"> {selectedDataItem.userName || "Unknown User"}</span>
    </div>

    </div>
  );
}