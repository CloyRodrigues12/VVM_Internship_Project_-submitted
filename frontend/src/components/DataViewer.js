import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./DataViewer.css";

// Custom hook for debouncing input to prevent rapid API calls
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};

// --- Helper Components ---
const Highlight = ({ text, highlight }) => {
  if (!highlight || !text) {
    return <span>{text}</span>;
  }
  const parts = String(text).split(new RegExp(`(${highlight})`, "gi"));
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i}>{part}</mark>
        ) : (
          part
        )
      )}
    </span>
  );
};

const ConfirmationModal = ({
  message,
  onConfirm,
  onCancel,
  value,
  onValueChange,
  column,
  recordInfo,
}) => (
  <div className="modal-overlay">
    <div className="confirmation-modal">
      <div className="modal-header">
        <h3>Confirm Edit</h3>
      </div>
      <div className="modal-body">
        <p>{message}</p>
        <div className="record-info">{recordInfo}</div>
        <div className="input-group">
          <label htmlFor="confirm-value">
            New Value for <strong>{column}</strong>:
          </label>
          <input
            id="confirm-value"
            type="text"
            value={value}
            onChange={onValueChange}
            className="confirmation-input"
            autoFocus
          />
        </div>
      </div>
      <div className="modal-actions">
        <button onClick={onConfirm} className="confirm-button">
          Save Changes
        </button>
        <button onClick={onCancel} className="cancel-button">
          Cancel
        </button>
      </div>
    </div>
  </div>
);

// --- Main DataViewer Component ---
const DataViewer = () => {
  const [selectedTable, setSelectedTable] = useState("students_details_master");
  const [tableData, setTableData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);
  const [filters, setFilters] = useState([{ id: 1, column: "", value: "" }]);
  const debouncedFilters = useDebounce(filters, 500);

  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const api = useMemo(
    () => ({
      get: async (url) => {
        const token = localStorage.getItem("token");
        const response = await fetch(`http://localhost:5000${url}`, {
          headers: { "x-access-token": token },
        });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(
            errData.error || `HTTP error! status: ${response.status}`
          );
        }
        return response.json();
      },
      post: async (url, body) => {
        const token = localStorage.getItem("token");
        const response = await fetch(`http://localhost:5000${url}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-access-token": token,
          },
          body: JSON.stringify(body),
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

  // Effect for when the selected table changes
  useEffect(() => {
    const fetchSchema = async () => {
      setLoading(true);
      setError("");
      setTableData([]);
      setColumns([]);
      setPage(1);
      setFilters([{ id: 1, column: "", value: "" }]);

      try {
        const schema = await api.get(`/api/table-schema/${selectedTable}`);
        setColumns(schema);
      } catch (err) {
        setError(`Failed to load table schema: ${err.message}`);
        setLoading(false);
      }
    };
    fetchSchema();
  }, [selectedTable, api]);

  // Effect for fetching data when dependencies that trigger a new search change
  useEffect(() => {
    const fetchData = async () => {
      if (columns.length === 0) return; // Wait for schema to be loaded

      setLoading(true);
      setError("");
      try {
        // Use the search term from the first filter for global search, or specific column
        const activeFilter = debouncedFilters.find((f) => f.value) || {
          value: "",
          column: "",
        };
        const searchTerm = encodeURIComponent(activeFilter.value);
        const searchColumn = encodeURIComponent(activeFilter.column);

        const dataResponse = await api.get(
          `/api/table-data/${selectedTable}?page=${page}&limit=${limit}&search=${searchTerm}&column=${searchColumn}`
        );
        setTableData(dataResponse.data);
        setTotalRecords(dataResponse.total);
      } catch (err) {
        setError(err.message);
        setTableData([]);
        setTotalRecords(0);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [page, debouncedFilters, columns, selectedTable, limit, api]);

  // Effect to reset page to 1 ONLY when the actual debounced filter text changes
  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    }
  }, [debouncedFilters]);

  const displayColumns = useMemo(() => {
    const activeFilterColumns = filters
      .map((f) => f.column)
      .filter((c) => c && columns.includes(c));
    const uniqueActiveFilterColumns = [...new Set(activeFilterColumns)];

    if (uniqueActiveFilterColumns.length > 0) {
      const otherColumns = columns.filter(
        (c) => !uniqueActiveFilterColumns.includes(c)
      );
      return [...uniqueActiveFilterColumns, ...otherColumns];
    }
    return columns;
  }, [columns, filters]);

  const handleTableChange = (e) => {
    setSelectedTable(e.target.value);
  };

  const handleFilterChange = (id, field, value) => {
    setFilters((currentFilters) =>
      currentFilters.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  };

  const addFilter = () => {
    setFilters([...filters, { id: Date.now(), column: "", value: "" }]);
  };

  const removeFilter = (id) => {
    setFilters(filters.filter((f) => f.id !== id));
  };

  const handleCellClick = (rowIndex, column, currentValue) => {
    if (
      [
        "master_id",
        "id",
        "student_reference_id",
        "institution_code",
        "fees_trans_id",
      ].includes(column)
    )
      return;
    setEditingCell({ rowIndex, column });
    setEditValue(
      currentValue === null || currentValue === undefined
        ? ""
        : String(currentValue)
    );
    setShowConfirmModal(true);
  };

  const handleUpdateConfirm = async () => {
    if (!editingCell) return;

    const { rowIndex, column } = editingCell;
    const record = tableData[rowIndex];
    const id_column =
      selectedTable === "students_details_master"
        ? "master_id"
        : "fees_trans_id";
    const record_id = record[id_column];

    try {
      await api.post(`/api/update-record/${selectedTable}`, {
        id: record_id,
        column: column,
        value: editValue,
      });
      setTableData((currentData) =>
        currentData.map((row, index) => {
          if (index === rowIndex) {
            return { ...row, [column]: editValue };
          }
          return row;
        })
      );
    } catch (err) {
      setError(`Update failed: ${err.message}`);
    } finally {
      setEditingCell(null);
      setShowConfirmModal(false);
    }
  };

  const getRecordInfoForModal = () => {
    if (!editingCell) return "";
    const record = tableData[editingCell.rowIndex];
    const idCol =
      selectedTable === "students_details_master"
        ? "master_id"
        : "fees_trans_id";
    const nameCol = record.student_name || record.full_name;
    return `Record ID: ${record[idCol]}${nameCol ? ` | Name: ${nameCol}` : ""}`;
  };

  const totalPages = Math.ceil(totalRecords / limit);

  return (
    <div className="data-viewer-container">
      <div className="content-header">
        <h2>Database Viewer</h2>
        <p>View, search, and edit records from the master tables.</p>
      </div>
      <div className="viewer-controls">
        <div className="table-selector">
          <label htmlFor="table-select">Select Table:</label>
          <select
            id="table-select"
            value={selectedTable}
            onChange={handleTableChange}
          >
            <option value="students_details_master">Student Details</option>
            <option value="student_fee_transactions">Fee Transactions</option>
          </select>
        </div>
        <div className="filter-controls">
          {filters.map((filter) => (
            <div key={filter.id} className="filter-row">
              <select
                value={filter.column}
                onChange={(e) =>
                  handleFilterChange(filter.id, "column", e.target.value)
                }
              >
                <option value="">Search All Columns</option>
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Enter filter value..."
                value={filter.value}
                onChange={(e) =>
                  handleFilterChange(filter.id, "value", e.target.value)
                }
              />
              {filters.length > 1 && (
                <button
                  className="remove-filter-btn"
                  onClick={() => removeFilter(filter.id)}
                >
                  &times;
                </button>
              )}
            </div>
          ))}
          <button className="add-filter-btn" onClick={addFilter}>
            + Add Filter
          </button>
        </div>
      </div>

      {loading && <div className="loading-indicator">Loading...</div>}
      {error && <div className="error-message">{error}</div>}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {displayColumns.map((col) => (
                <th key={col}>{col.replace(/_/g, " ").toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.length > 0 ? (
              tableData.map((row, rowIndex) => (
                <tr
                  key={
                    row[
                      selectedTable === "students_details_master"
                        ? "master_id"
                        : "fees_trans_id"
                    ] || rowIndex
                  }
                >
                  {displayColumns.map((col) => (
                    <td
                      key={col}
                      data-editable={
                        ![
                          "master_id",
                          "id",
                          "student_reference_id",
                          "institution_code",
                          "fees_trans_id",
                        ].includes(col)
                      }
                      onClick={() => handleCellClick(rowIndex, col, row[col])}
                    >
                      <Highlight
                        text={String(row[col] ?? "")}
                        highlight={
                          filters.find((f) => f.column === col || !f.column)
                            ?.value
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length || 1} className="no-data-cell">
                  {!loading && "No records found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1 || loading}
        >
          Previous
        </button>
        <span>
          Page {page} of {totalPages || 1}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages || loading}
        >
          Next
        </button>
      </div>

      {showConfirmModal && (
        <ConfirmationModal
          message={`You are about to edit a record.`}
          recordInfo={getRecordInfoForModal()}
          onConfirm={handleUpdateConfirm}
          onCancel={() => setShowConfirmModal(false)}
          value={editValue}
          onValueChange={(e) => setEditValue(e.target.value)}
          column={editingCell.column}
        />
      )}
    </div>
  );
};

export default DataViewer;
