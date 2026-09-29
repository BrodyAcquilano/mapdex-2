function NotesField({
  currentInput,
  handleNotesChange,
  isLockedField,
}) {
  return (
    <label className="input-configurator-notes">
      Notes for Add Modal:
      <textarea
        value={currentInput.notes ?? ""}
        onChange={handleNotesChange}
        maxLength={50}
        rows={1}
        disabled={isLockedField("notes")}
      />
    </label>
  );
}

export default NotesField;
