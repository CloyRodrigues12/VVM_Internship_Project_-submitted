import React, { useState, useEffect, useMemo, useCallback } from "react";
import "./BulkUpdate.css";

const BulkUpdate = () => {
  const [step, setStep] = useState(1);
  const [selectedTable, setSelectedTable] = useState("students_details_master");
  const [columns, setColumns] = useState([]);
  const [identifierColumn, setIdentifierColumn] = useState("");
  const [updateColumns, setUpdateColumns] = useState([]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [proceedWithErrors, setProceedWithErrors] = useState(false);

  const api = useMemo(
    () => ({
      get: async (url, params = {}) => {
        const token = localStorage.getItem("token");
        const query = new URLSearchParams(params).toString();
        const response = await fetch(`http://localhost:5000${url}?${query}`, {
          headers: { "x-access-token": token },
        });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(
            errData.error || `HTTP error! status: ${response.status}`
          );
        }
        return response;
      },
      post: async (url, body) => {
        const token = localStorage.getItem("token");
        const response = await fetch(`http://localhost:5000${url}`, {
          method: "POST",
          headers: { "x-access-token": token },
          body: body,
        });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(
            errData.error || `HTTP error! status: ${response.status}`
          );
        }
        return response.json();
      },
    }),
    []
  );

  const fetchSchema = useCallback(async () => {
    if (!selectedTable) return;
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/api/table-schema/${selectedTable}`);
      const schema = await response.json();
      setColumns(schema);
      setIdentifierColumn(schema[0] || ""); // Default to first column
      setUpdateColumns([]);
    } catch (err) {
      setError(`Failed to fetch schema: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedTable, api]);

  useEffect(() => {
    fetchSchema();
  }, [fetchSchema]);

  const handleColumnToggle = (column) => {
    setUpdateColumns((prev) =>
      prev.includes(column)
        ? prev.filter((c) => c !== column)
        : [...prev, column]
    );
  };

  const handleDownloadTemplate = async () => {
    if (!identifierColumn || updateColumns.length === 0) {
      setError(
        "Please select an identifier and at least one column to update."
      );
      return;
    }
    setError("");
    setLoading(true);
    try {
      const response = await api.get("/api/bulk-update/download-template", {
        table_name: selectedTable,
        identifier_column: identifierColumn,
        update_columns: JSON.stringify(updateColumns),
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bulk_update_${selectedTable}_template.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Failed to download template: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }
    setError("");
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("table_name", selectedTable);
    formData.append("identifier_column", identifierColumn);

    try {
      const previewData = await api.post(
        "/api/bulk-update/preview-upload",
        formData
      );
      setPreview(previewData);
      setStep(3);
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteUpdate = async () => {
    if (!preview) return;

    setLoading(true);
    setError("");

    const payload = {
      table_name: selectedTable,
      identifier_column: identifierColumn,
      updates: preview.valid_updates,
    };

    try {
      const result = await api.post(
        "/api/bulk-update/execute",
        new Blob([JSON.stringify(payload)], { type: "application/json" })
      );
      setPreview(result); // The backend will return a final report
      setStep(4);
    } catch (err) {
      setError(`Execution failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetProcess = () => {
    setStep(1);
    setFile(null);
    setPreview(null);
    setError("");
    setProceedWithErrors(false);
    fetchSchema();
  };

  const renderStep1 = () => (
    <div className="step-container">
      <h3>Step 1: Configure and Download Template</h3>
      <div className="config-grid">
        <div className="form-group">
          <label>Table to Update</label>
          <select
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
          >
            <option value="students_details_master">Student Details</option>
            <option value="student_fee_transactions">Fee Transactions</option>
          </select>
        </div>
        <div className="form-group">
          <label>Unique Identifier Column</label>
          <select
            value={identifierColumn}
            onChange={(e) => setIdentifierColumn(e.target.value)}
          >
            {columns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>Columns to Update</label>
        <div className="column-checklist">
          {columns
            .filter((c) => c !== identifierColumn)
            .map((col) => (
              <div key={col} className="checkbox-item">
                <input
                  type="checkbox"
                  id={col}
                  value={col}
                  checked={updateColumns.includes(col)}
                  onChange={() => handleColumnToggle(col)}
                />
                <label htmlFor={col}>{col}</label>
              </div>
            ))}
        </div>
      </div>
      <button
        className="action-button"
        onClick={handleDownloadTemplate}
        disabled={loading || updateColumns.length === 0}
      >
        {loading ? "Generating..." : "Download Template"}
      </button>
      <button
        className="next-step-button"
        onClick={() => setStep(2)}
        disabled={updateColumns.length === 0}
      >
        Next: Upload File &rarr;
      </button>
    </div>
  );

  const renderStep2 = () => (
    <div className="step-container">
      <h3>Step 2: Upload Completed File</h3>
      <div
        className="file-drop-zone"
        onClick={() => document.getElementById("fileInput").click()}
      >
        <input
          type="file"
          id="fileInput"
          style={{ display: "none" }}
          accept=".xlsx, .xls"
          onChange={(e) => setFile(e.target.files[0])}
        />
        <p>
          {file
            ? `Selected: ${file.name}`
            : "Click or drag file here to upload"}
        </p>
      </div>
      <div className="step-navigation">
        <button className="back-step-button" onClick={() => setStep(1)}>
          {" "}
          &larr; Back to Configuration
        </button>
        <button
          className="action-button"
          onClick={handleFileUpload}
          disabled={loading || !file}
        >
          {loading ? "Processing..." : "Preview Changes"}
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="step-container">
      <h3>Step 3: Review and Confirm Changes</h3>
      {preview && (
        <div className="preview-summary">
          <div className="summary-card valid">
            <h4>{preview.valid_updates.length}</h4>
            <p>Valid Records to Update</p>
          </div>
          <div
            className={`summary-card ${
              preview.invalid_rows.length > 0 ? "invalid" : ""
            }`}
          >
            <h4>{preview.invalid_rows.length}</h4>
            <p>Invalid or Missing IDs</p>
          </div>
        </div>
      )}
      {preview && preview.invalid_rows.length > 0 && (
        <div className="error-details">
          <h4>Invalid IDs Found</h4>
          <p>
            The following identifiers from your file were not found in the
            database and will be skipped:
          </p>
          <div className="error-list">
            {preview.invalid_rows.map((item) => (
              <span key={item.id} className="error-tag">
                {item.id}
              </span>
            ))}
          </div>
          <div className="confirmation-checkbox">
            <input
              type="checkbox"
              id="proceed-check"
              checked={proceedWithErrors}
              onChange={(e) => setProceedWithErrors(e.target.checked)}
            />
            <label htmlFor="proceed-check">
              I acknowledge the errors and want to proceed with updating the
              valid records.
            </label>
          </div>
        </div>
      )}
      <div className="step-navigation">
        <button className="back-step-button" onClick={() => setStep(2)}>
          {" "}
          &larr; Back to Upload
        </button>
        <button
          className="action-button confirm-update"
          onClick={handleExecuteUpdate}
          disabled={
            loading || (preview.invalid_rows.length > 0 && !proceedWithErrors)
          }
        >
          {loading
            ? "Updating..."
            : `Update ${preview.valid_updates.length} Records`}
        </button>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="step-container">
      <h3>Step 4: Update Complete</h3>
      {preview && (
        <div className="preview-summary">
          <div className="summary-card valid">
            <h4>{preview.updated_count}</h4>
            <p>Records Successfully Updated</p>
          </div>
          <div
            className={`summary-card ${
              preview.skipped_count > 0 ? "invalid" : ""
            }`}
          >
            <h4>{preview.skipped_count}</h4>
            <p>Records Skipped</p>
          </div>
        </div>
      )}
      <p className="final-message">{preview?.message}</p>
      <button className="action-button" onClick={resetProcess}>
        Start New Bulk Update
      </button>
    </div>
  );

  return (
    <div className="data-viewer-container">
      <div className="content-header">
        <h2>Bulk Data Update</h2>
        <p>
          Follow the steps to update multiple records at once using an Excel
          template.
        </p>
      </div>
      {error && <div className="error-message">{error}</div>}

      <div className="bulk-update-stepper">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>
    </div>
  );
};

export default BulkUpdate;
