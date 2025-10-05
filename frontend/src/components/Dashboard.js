import React, { useState, useEffect, useMemo } from "react";
import { Doughnut, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from "chart.js";
import "./Dashboard.css";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement
);

const Dashboard = () => {
  // State for student data
  const [studentData, setStudentData] = useState(null);
  const [feesData, setFeesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search and modal states for students
  const [isStudentPopupOpen, setIsStudentPopupOpen] = useState(false);
  const [studentPopupData, setStudentPopupData] = useState({
    title: "",
    students: [],
    filterParams: {},
  });
  const [studentPopupSearchTerm, setStudentPopupSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isStudentDetailViewOpen, setIsStudentDetailViewOpen] = useState(false);

  // Search and modal states for fees
  const [isFeesPopupOpen, setIsFeesPopupOpen] = useState(false);
  const [feesPopupData, setFeesPopupData] = useState({
    title: "",
    transactions: [],
    filterParams: {},
  });
  const [feesPopupSearchTerm, setFeesPopupSearchTerm] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isTransactionDetailViewOpen, setIsTransactionDetailViewOpen] =
    useState(false);

  // Updated color palette with brighter and pastel colors
  const brightColors = [
    "#4BC0C0",
    "#FF6384",
    "#FF9F40",
    "#FFCD56",
    "#36A2EB",
    "#9966FF",
    "#FF99CC",
    "#66FF99",
    "#FF6666",
    "#66CCFF",
    "#CC99FF",
    "#FFCC99",
    "#99FFCC",
    "#FF99FF",
    "#FFFF99",
    "#99FFFF",
    "#FFB366",
    "#B366FF",
    "#66FFB3",
    "#FF66B3",
    "#B3FF66",
    "#66B3FF",
    "#FF66FF",
    "#B3FFB3",
    "#FFB3FF",
    "#B3B3FF",
    "#FFFFB3",
    "#B3FFFF",
    "#FFD700",
    "#9370DB",
  ];

  // Function to generate bright colors with different intensities
  const getBrightColors = (count) => {
    if (count <= brightColors.length) {
      return brightColors.slice(0, count);
    }

    // If we need more colors than available, generate intermediate shades
    const colors = [];
    for (let i = 0; i < count; i++) {
      const baseIndex = i % brightColors.length;
      const nextIndex = (baseIndex + 1) % brightColors.length;
      const ratio = i / count;

      // Blend between two adjacent colors for smooth transitions
      colors.push(
        blendColors(brightColors[baseIndex], brightColors[nextIndex], ratio)
      );
    }
    return colors;
  };

  // Helper function to blend two colors
  const blendColors = (color1, color2, ratio) => {
    const r1 = parseInt(color1.substring(1, 3), 16);
    const g1 = parseInt(color1.substring(3, 5), 16);
    const b1 = parseInt(color1.substring(5, 7), 16);

    const r2 = parseInt(color2.substring(1, 3), 16);
    const g2 = parseInt(color2.substring(3, 5), 16);
    const b2 = parseInt(color2.substring(5, 7), 16);

    const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
    const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
    const b = Math.round(b1 * (1 - ratio) + b2 * ratio);

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  };

  // Helper function to safely format amounts
  const formatAmount = (amount) => {
    if (amount === null || amount === undefined) return "0";
    if (typeof amount === "string") {
      const num = parseFloat(amount);
      return isNaN(num) ? "0" : num.toLocaleString("en-IN");
    }
    return amount.toLocaleString("en-IN");
  };

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      setError("");
      try {
        const token = localStorage.getItem("token");

        // Fetch both student and fees data
        const [studentResponse, feesResponse] = await Promise.all([
          fetch(`http://localhost:5000/api/dashboard/students`, {
            headers: { "x-access-token": token },
          }),
          fetch(`http://localhost:5000/api/dashboard/fees`, {
            headers: { "x-access-token": token },
          }),
        ]);

        if (!studentResponse.ok || !feesResponse.ok) {
          throw new Error("Failed to fetch dashboard data");
        }

        const studentResult = await studentResponse.json();
        const feesResult = await feesResponse.json();

        setStudentData(studentResult);
        setFeesData(feesResult);
      } catch (err) {
        setError(`Failed to fetch dashboard data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // Student chart data
  const studentChartDataSets = useMemo(() => {
    if (!studentData) return {};

    return {
      gender: {
        labels: (studentData.genderDistribution || []).map((d) => d.gender),
        datasets: [
          {
            data: (studentData.genderDistribution || []).map((d) => d.count),
            backgroundColor: getBrightColors(
              (studentData.genderDistribution || []).length
            ),
          },
        ],
      },
      category: {
        labels: (studentData.categoryDistribution || []).map(
          (d) => d.student_category
        ),
        datasets: [
          {
            data: (studentData.categoryDistribution || []).map((d) => d.count),
            backgroundColor: getBrightColors(
              (studentData.categoryDistribution || []).length
            ),
          },
        ],
      },
      religion: {
        labels: (studentData.religionDistribution || []).map((d) => d.religion),
        datasets: [
          {
            label: "Students",
            data: (studentData.religionDistribution || []).map((d) => d.count),
            backgroundColor: getBrightColors(
              (studentData.religionDistribution || []).length
            ),
          },
        ],
      },
      stream: {
        labels: (studentData.streamDistribution || []).map((d) => d.stream),
        datasets: [
          {
            label: "Students",
            data: (studentData.streamDistribution || []).map((d) => d.count),
            backgroundColor: getBrightColors(
              (studentData.streamDistribution || []).length
            ),
          },
        ],
      },
    };
  }, [studentData]);

  // Fees chart data
  const feesChartDataSets = useMemo(() => {
    if (!feesData) return {};

    return {
      paymentStatus: {
        labels: (feesData.paymentStatusDistribution || []).map((d) => d.label),
        datasets: [
          {
            data: (feesData.paymentStatusDistribution || []).map(
              (d) => d.count
            ),
            backgroundColor: getBrightColors(
              (feesData.paymentStatusDistribution || []).length
            ),
          },
        ],
      },
      courseRevenue: {
        labels: (feesData.courseRevenueDistribution || []).map((d) => d.label),
        datasets: [
          {
            label: "Revenue",
            data: (feesData.courseRevenueDistribution || []).map(
              (d) => d.amount
            ),
            backgroundColor: getBrightColors(
              (feesData.courseRevenueDistribution || []).length
            ),
          },
        ],
      },
      institutionRevenue: {
        labels: (feesData.institutionRevenueDistribution || []).map(
          (d) => d.label
        ),
        datasets: [
          {
            label: "Revenue",
            data: (feesData.institutionRevenueDistribution || []).map(
              (d) => d.amount
            ),
            backgroundColor: getBrightColors(
              (feesData.institutionRevenueDistribution || []).length
            ),
          },
        ],
      },
      installment: {
        labels: (feesData.installmentDistribution || []).map((d) => d.label),
        datasets: [
          {
            label: "Transactions",
            data: (feesData.installmentDistribution || []).map((d) => d.count),
            backgroundColor: getBrightColors(
              (feesData.installmentDistribution || []).length
            ),
          },
        ],
      },
    };
  }, [feesData]);

  // Student chart list
  const studentChartList = useMemo(
    () => [
      {
        id: "gender",
        title: "Gender Distribution",
        type: "Doughnut",
        data: studentChartDataSets.gender,
        filterKey: "gender",
      },
      {
        id: "category",
        title: "Student Category",
        type: "Doughnut",
        data: studentChartDataSets.category,
        filterKey: "student_category",
      },
      {
        id: "religion",
        title: "Religion Distribution",
        type: "Bar",
        data: studentChartDataSets.religion,
        filterKey: "religion",
      },
      {
        id: "stream",
        title: "Stream Enrollment",
        type: "Bar",
        data: studentChartDataSets.stream,
        options: { indexAxis: "y" },
        filterKey: "stream",
      },
    ],
    [studentChartDataSets]
  );

  // Fees chart list
  const feesChartList = useMemo(
    () => [
      {
        id: "paymentStatus",
        title: "Payment Status Distribution",
        type: "Doughnut",
        data: feesChartDataSets.paymentStatus,
        filterKey: "payment_status",
      },
      {
        id: "courseRevenue",
        title: "Course-wise Revenue Distribution",
        type: "Bar",
        data: feesChartDataSets.courseRevenue,
        filterKey: "course_name",
      },
      {
        id: "institutionRevenue",
        title: "Institution-wise Revenue",
        type: "Bar",
        data: feesChartDataSets.institutionRevenue,
        filterKey: "institution_code",
      },
      {
        id: "installment",
        title: "Installment Distribution",
        type: "Bar",
        data: feesChartDataSets.installment,
        options: { indexAxis: "y" },
        filterKey: "installment_no",
      },
    ],
    [feesChartDataSets]
  );

  // Student chart click handler
  const handleStudentChartClick = async (filterType, chartData, element) => {
    if (!element.length) return;
    const index = element[0].index;
    const filterValue = chartData.labels[index];

    setLoading(true);
    const filterParams = {
      filterType,
      filterValue,
    };

    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams(filterParams);
      const response = await fetch(
        `http://localhost:5000/api/students/list?${params.toString()}`,
        { headers: { "x-access-token": token } }
      );
      if (!response.ok) throw new Error("Failed to fetch student list");
      const students = await response.json();
      setStudentPopupData({
        title: `${filterType.replace(/_/g, " ")}: ${filterValue}`,
        students,
        filterParams,
      });
      setIsStudentPopupOpen(true);
    } catch (err) {
      setError(`Could not load student list. ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fees chart click handler
  const handleFeesChartClick = async (
    filterType,
    chartData,
    element,
    chartId
  ) => {
    if (!element.length) return;
    const index = element[0].index;
    const filterValue = chartData.labels[index];

    // Handle special cases for different chart types
    let actualFilterType = filterType;
    let actualFilterValue = filterValue;
    let additionalFilters = {};

    // Special handling for different chart types
    if (chartId === "courseRevenue") {
      // For course revenue, show only paid students of that course
      additionalFilters.payment_status = "PAID";
    } else if (chartId === "institutionRevenue") {
      // For institution revenue, show paid students of that institution
      additionalFilters.payment_status = "PAID";
    }

    setLoading(true);
    const filterParams = {
      filterType: actualFilterType,
      filterValue: actualFilterValue,
      ...additionalFilters,
    };

    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams(filterParams);
      const response = await fetch(
        `http://localhost:5000/api/transactions/list?${params.toString()}`,
        { headers: { "x-access-token": token } }
      );
      if (!response.ok) throw new Error("Failed to fetch transaction list");
      const transactions = await response.json();

      let displayTitle = `${actualFilterType.replace(
        /_/g,
        " "
      )}: ${actualFilterValue}`;

      setFeesPopupData({
        title: displayTitle,
        transactions,
        filterParams,
      });
      setIsFeesPopupOpen(true);
    } catch (err) {
      setError(`Could not load transaction list. ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Student detail view handler
  const handleViewStudentDetails = async (studentRefId, masterId) => {
    // Prefer masterId if available, otherwise fall back to studentRefId
    const identifier = masterId || studentRefId;
    const identifierType = masterId ? "master_id" : "student_reference_id";

    if (!identifier) {
      setError("Student identifier is missing.");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");

      const response = await fetch(
        `http://localhost:5000/api/students/details/${identifier}?identifier_type=${identifierType}`,
        { headers: { "x-access-token": token } }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: Failed to fetch student details`
        );
      }

      const details = await response.json();

      if (!details || !details.details) {
        throw new Error("No student data received from server");
      }

      setSelectedStudent(details);
      setIsStudentPopupOpen(false);
      setIsStudentDetailViewOpen(true);
    } catch (err) {
      setError(`Could not load student details. ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Transaction detail view handler
  const handleViewTransactionDetails = (transaction) => {
    setSelectedTransaction(transaction);
    setIsFeesPopupOpen(false);
    setIsTransactionDetailViewOpen(true);
  };

  // KPI click handlers
  const handleStudentKpiClick = async (kpiType) => {
    setLoading(true);

    const filterParams = {};

    // Add gender filter for male/female KPIs
    if (kpiType === "male_students") {
      filterParams.gender = "Male";
    } else if (kpiType === "female_students") {
      filterParams.gender = "Female";
    }

    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams(filterParams);

      // Fetch student list for the KPI
      const response = await fetch(
        `http://localhost:5000/api/students/list?${params.toString()}`,
        { headers: { "x-access-token": token } }
      );

      if (!response.ok) throw new Error("Failed to fetch student list");
      const students = await response.json();

      // Set appropriate title based on KPI type
      let title = "";
      switch (kpiType) {
        case "total_students":
          title = "All Students";
          break;
        case "male_students":
          title = "Male Students";
          break;
        case "female_students":
          title = "Female Students";
          break;
        default:
          title = "Student List";
      }

      setStudentPopupData({
        title,
        students,
        filterParams,
      });
      setIsStudentPopupOpen(true);
    } catch (err) {
      setError(`Could not load student list. ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFeesKpiClick = async (kpiType) => {
    setLoading(true);

    // Set filter parameters based on KPI type
    const filterParams = {};

    // Set payment status filter based on KPI type
    switch (kpiType) {
      case "total_transactions":
        // All transactions - no payment status filter
        break;
      case "successful_transactions":
        filterParams.payment_status = "PAID";
        break;
      case "pending_transactions":
        filterParams.payment_status = "UNPAID,PARTIAL_PAID";
        break;
      default:
        break;
    }

    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams(filterParams);

      // Fetch transaction list for the KPI
      const response = await fetch(
        `http://localhost:5000/api/transactions/list?${params.toString()}`,
        { headers: { "x-access-token": token } }
      );

      if (!response.ok) throw new Error("Failed to fetch transaction list");
      const transactions = await response.json();

      // Set appropriate title based on KPI type
      let title = "";
      switch (kpiType) {
        case "total_transactions":
          title = "All Transactions";
          break;
        case "successful_transactions":
          title = "Successful Transactions (PAID)";
          break;
        case "pending_transactions":
          title = "Pending Transactions (UNPAID/PARTIAL_PAID)";
          break;
        default:
          title = "Transaction List";
      }

      setFeesPopupData({
        title,
        transactions,
        filterParams,
      });
      setIsFeesPopupOpen(true);
    } catch (err) {
      setError(`Could not load transaction list. ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Export functions
  const exportStudentData = async (data) => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch("http://localhost:5000/api/export/excel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-access-token": token,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Excel export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "student_list.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError(`Export failed: ${err.message}`);
    }
  };

  const exportFeesData = async (data) => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch("http://localhost:5000/api/export/excel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-access-token": token,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Excel export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "transactions_list.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError(`Export failed: ${err.message}`);
    }
  };

  // Filtering logic for popups
  const filteredStudentPopupStudents = useMemo(() => {
    if (!studentPopupSearchTerm) return studentPopupData.students;
    return studentPopupData.students.filter((s) =>
      Object.values(s).some((v) =>
        String(v).toLowerCase().includes(studentPopupSearchTerm.toLowerCase())
      )
    );
  }, [studentPopupSearchTerm, studentPopupData.students]);

  const filteredFeesPopupTransactions = useMemo(() => {
    if (!feesPopupSearchTerm) return feesPopupData.transactions;
    return feesPopupData.transactions.filter((t) =>
      Object.values(t).some((v) =>
        String(v).toLowerCase().includes(feesPopupSearchTerm.toLowerCase())
      )
    );
  }, [feesPopupSearchTerm, feesPopupData.transactions]);

  // Chart render functions
  const renderStudentChart = ({
    id,
    title,
    type,
    data,
    options = {},
    filterKey,
  }) => {
    const ChartComponent = { Doughnut, Bar }[type];
    if (!data || !data.labels || data.labels.length === 0)
      return (
        <div className="chart-card">
          <h3>{title}</h3>
          <p>No data available.</p>
        </div>
      );
    return (
      <div key={id} className="chart-card">
        <h3>{title}</h3>
        <div className="chart-container">
          <ChartComponent
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: "top",
                },
              },
              ...options,
              onClick: (evt, el) =>
                handleStudentChartClick(filterKey, data, el),
            }}
          />
        </div>
      </div>
    );
  };

  const renderFeesChart = ({
    id,
    title,
    type,
    data,
    options = {},
    filterKey,
  }) => {
    const ChartComponent = { Doughnut, Bar }[type];

    // Determine which handler to use
    const onClickHandler = (evt, el) =>
      handleFeesChartClick(filterKey, data, el, id);

    if (!data || !data.labels || data.labels.length === 0)
      return (
        <div className="chart-card">
          <h3>{title}</h3>
          <p>No data available.</p>
        </div>
      );

    return (
      <div key={id} className="chart-card">
        <h3>{title}</h3>
        <div className="chart-container">
          <ChartComponent
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              ...options,
              onClick: onClickHandler,
            }}
          />
        </div>
      </div>
    );
  };

  if (
    loading &&
    !isStudentPopupOpen &&
    !isStudentDetailViewOpen &&
    !isFeesPopupOpen &&
    !isTransactionDetailViewOpen
  )
    return <div className="loading-indicator">Loading Dashboard...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="dashboard-container">
      <div className="header-container">
        <h2>Dashboard</h2>
      </div>

      {/* Student KPIs */}

      {!studentData || !studentData.kpis ? (
        <div className="error-message">No student data available.</div>
      ) : (
        <>
          <div className="kpi-grid">
            <div
              className="kpi-card"
              onClick={() => handleStudentKpiClick("total_students")}
            >
              <div className="kpi-info">
                <div className="kpi-value">
                  {studentData.kpis.total_students.toLocaleString()}
                </div>
                <div className="kpi-label">Total Students</div>
              </div>
            </div>
            <div
              className="kpi-card male"
              onClick={() => handleStudentKpiClick("male_students")}
            >
              <div className="kpi-info">
                <div className="kpi-value">
                  {studentData.kpis.male_students.toLocaleString()}
                </div>
                <div className="kpi-label">Male Students</div>
              </div>
            </div>
            <div
              className="kpi-card female"
              onClick={() => handleStudentKpiClick("female_students")}
            >
              <div className="kpi-info">
                <div className="kpi-value">
                  {studentData.kpis.female_students.toLocaleString()}
                </div>
                <div className="kpi-label">Female Students</div>
              </div>
            </div>
          </div>
          {/* Fees KPIs */}

          {!feesData || !feesData.kpis ? (
            <div className="error-message">No fees data available.</div>
          ) : (
            <>
              <div className="kpi-grid">
                <div
                  className="kpi-card total-trans"
                  onClick={() => handleFeesKpiClick("total_transactions")}
                >
                  <div className="kpi-value">
                    {feesData.kpis.total_transactions
                      ? feesData.kpis.total_transactions.toLocaleString("en-IN")
                      : "0"}
                  </div>
                  <div className="kpi-label">Total Transactions</div>
                </div>
                <div
                  className="kpi-card successful-trans"
                  onClick={() => handleFeesKpiClick("successful_transactions")}
                >
                  <div className="kpi-value">
                    {feesData.kpis.successful_transactions
                      ? feesData.kpis.successful_transactions.toLocaleString(
                          "en-IN"
                        )
                      : "0"}
                  </div>
                  <div className="kpi-label">Successful Transactions</div>
                </div>
                <div
                  className="kpi-card pending-trans"
                  onClick={() => handleFeesKpiClick("pending_transactions")}
                >
                  <div className="kpi-value">
                    {feesData.kpis.pending_transactions
                      ? feesData.kpis.pending_transactions.toLocaleString(
                          "en-IN"
                        )
                      : "0"}
                  </div>
                  <div className="kpi-label">Pending Transactions</div>
                </div>
              </div>

              <div className="charts-grid">
                {feesChartList.length > 0 ? (
                  feesChartList.map(renderFeesChart)
                ) : (
                  <p>No fees charts available.</p>
                )}
              </div>
            </>
          )}
          <div className="charts-grid">
            {studentChartList.length > 0 ? (
              studentChartList.map(renderStudentChart)
            ) : (
              <p>No student charts available.</p>
            )}
          </div>
        </>
      )}

      {/* Student Popup Modal */}
      {isStudentPopupOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsStudentPopupOpen(false)}
        >
          <div
            className="modal-content full-width"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{studentPopupData.title}</h3>
              <button
                onClick={() => setIsStudentPopupOpen(false)}
                className="close-button"
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-controls">
                <button
                  onClick={() =>
                    exportStudentData(filteredStudentPopupStudents)
                  }
                  className="export-btn"
                >
                  Export Excel
                </button>
                <input
                  type="text"
                  placeholder="Search..."
                  className="modal-search"
                  value={studentPopupSearchTerm}
                  onChange={(e) => setStudentPopupSearchTerm(e.target.value)}
                />
              </div>
              <div className="student-list-container">
                <table className="student-list-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Institution</th>
                      <th>Category</th>
                      <th>Adm Date</th>
                      <th>Gender</th>
                      <th>Mobile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudentPopupStudents.map((s) => (
                      <tr
                        key={s.master_id}
                        onClick={() =>
                          handleViewStudentDetails(
                            s.student_reference_id,
                            s.master_id
                          )
                        }
                      >
                        <td>{s.student_name}</td>
                        <td>{s.institution_code}</td>
                        <td>{s.student_category}</td>
                        <td>{s.admission_date}</td>
                        <td>{s.gender}</td>
                        <td>{s.mobile_number}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fees Popup Modal */}
      {isFeesPopupOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsFeesPopupOpen(false)}
        >
          <div
            className="modal-content large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{feesPopupData.title}</h3>
              <button
                onClick={() => setIsFeesPopupOpen(false)}
                className="close-button"
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-controls">
                <button
                  onClick={() => exportFeesData(filteredFeesPopupTransactions)}
                  className="view-full-list-btn"
                >
                  Export Excel
                </button>
                <input
                  type="text"
                  placeholder="Search..."
                  className="modal-search"
                  value={studentPopupSearchTerm}
                  onChange={(e) => setStudentPopupSearchTerm(e.target.value)}
                />
              </div>
              <div className="student-list-container">
                <table className="student-list-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Institution</th>
                      <th>Category</th>
                      <th>Adm Date</th>
                      <th>Gender</th>
                      <th>Mobile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudentPopupStudents.map((s) => (
                      <tr
                        key={s.master_id}
                        onClick={() =>
                          handleViewStudentDetails(
                            s.student_reference_id,
                            s.master_id
                          )
                        }
                      >
                        <td>{s.student_name}</td>
                        <td>{s.institution_code}</td>
                        <td>{s.student_category}</td>
                        <td>{s.admission_date}</td>
                        <td>{s.gender}</td>
                        <td>{s.mobile_number}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fees Popup Modal */}
      {isFeesPopupOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsFeesPopupOpen(false)}
        >
          <div
            className="modal-content large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{feesPopupData.title}</h3>
              <button
                onClick={() => setIsFeesPopupOpen(false)}
                className="close-button"
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-controls">
                <button
                  onClick={() => exportFeesData(filteredFeesPopupTransactions)}
                  className="view-full-list-btn"
                >
                  Export Excel
                </button>
                <input
                  type="text"
                  placeholder="Search Transactions..."
                  className="modal-search"
                  value={feesPopupSearchTerm}
                  onChange={(e) => setFeesPopupSearchTerm(e.target.value)}
                />
              </div>
              <div className="student-list-container">
                <table className="student-list-table">
                  <thead>
                    <tr>
                      <th>Registration Code</th>
                      <th>Student Name</th>
                      <th>Date</th>
                      <th>Amount Paid</th>
                      <th>Status</th>
                      <th>Mode</th>
                      <th>Installment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFeesPopupTransactions.map((t) => (
                      <tr
                        key={t.fees_trans_id}
                        onClick={() => handleViewTransactionDetails(t)}
                      >
                        <td>{t.registration_code || "N/A"}</td>
                        <td>{t.student_name || "N/A"}</td>
                        <td>{t.fees_paid_date || "N/A"}</td>
                        <td>{formatAmount(t.amount_paid || t.amt_paid)}</td>
                        <td>{t.payment_status || "N/A"}</td>
                        <td>{t.payment_mode || "N/A"}</td>
                        <td>{t.installment_no || "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Student Detail View Modal */}
      {isStudentDetailViewOpen && selectedStudent && (
        <div
          className="modal-overlay"
          onClick={() => setIsStudentDetailViewOpen(false)}
        >
          <div
            className="modal-content x-large full-width"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>
                {selectedStudent.details.student_name || "Unknown Student"} -
                Full Details
              </h3>
              <div>
                <button
                  onClick={() => {
                    setIsStudentDetailViewOpen(false);
                    setIsStudentPopupOpen(true);
                  }}
                  className="close-button back-to-list"
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="modal-body student-detail-view">
              {/* Student details content (same as before) */}
              <div className="detail-section">
                <h4>Personal Information</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <strong>Master ID:</strong>{" "}
                    {selectedStudent.details.master_id || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Reference ID:</strong>{" "}
                    {selectedStudent.details.student_reference_id || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Institution Code:</strong>{" "}
                    {selectedStudent.details.institution_code || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Admission No:</strong>{" "}
                    {selectedStudent.details.admission_no || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Admission Date:</strong>{" "}
                    {selectedStudent.details.admission_date
                      ? new Date(
                          selectedStudent.details.admission_date
                        ).toLocaleDateString()
                      : "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Admission Fee Payment Time:</strong>{" "}
                    {selectedStudent.details.admission_feepayment_time || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Class:</strong>{" "}
                    {selectedStudent.details.class || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Section:</strong>{" "}
                    {selectedStudent.details.section || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Stream:</strong>{" "}
                    {selectedStudent.details.stream || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Batch Year:</strong>{" "}
                    {selectedStudent.details.batch_year || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Admission Scheme:</strong>{" "}
                    {selectedStudent.details.admission_scheme || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>PR No:</strong>{" "}
                    {selectedStudent.details.pr_no || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Roll Number:</strong>{" "}
                    {selectedStudent.details.roll_number || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Student Name:</strong>{" "}
                    {selectedStudent.details.student_name || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Gender:</strong>{" "}
                    {selectedStudent.details.gender || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Student Category:</strong>{" "}
                    {selectedStudent.details.student_category || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Date of Birth:</strong>{" "}
                    {selectedStudent.details.date_of_birth
                      ? new Date(
                          selectedStudent.details.date_of_birth
                        ).toLocaleDateString()
                      : "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Religion:</strong>{" "}
                    {selectedStudent.details.religion || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Blood Group:</strong>{" "}
                    {selectedStudent.details.blood_group || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Email:</strong>{" "}
                    {selectedStudent.details.email_address || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Full Address:</strong>{" "}
                    {selectedStudent.details.full_address || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>City:</strong>{" "}
                    {selectedStudent.details.city || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>State:</strong>{" "}
                    {selectedStudent.details.state || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Pin Code:</strong>{" "}
                    {selectedStudent.details.pin_code || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Mobile Number:</strong>{" "}
                    {selectedStudent.details.mobile_number || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Alt Mobile Number:</strong>{" "}
                    {selectedStudent.details.alt_mobile_number || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Father's Mobile:</strong>{" "}
                    {selectedStudent.details.fathers_mobile_number || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Mother's Mobile:</strong>{" "}
                    {selectedStudent.details.mothers_mobile_number || "N/A"}
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Family Information</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <strong>Father's Name:</strong>{" "}
                    {selectedStudent.details.fathers_name || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Father's Occupation:</strong>{" "}
                    {selectedStudent.details.fathers_occupation || "N/A"}
                  </div>

                  <div className="detail-item">
                    <strong>Mother's Name:</strong>{" "}
                    {selectedStudent.details.mothers_name || "N/A"}
                  </div>

                  <div className="detail-item">
                    <strong>Mother's Occupation Category:</strong>{" "}
                    {selectedStudent.details.mothers_occupation || "N/A"}
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Additional Information</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <strong>Nationality:</strong>{" "}
                    {selectedStudent.details.nationality || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Mother Tongue:</strong>{" "}
                    {selectedStudent.details.mother_tongue || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Previous Institution:</strong>{" "}
                    {selectedStudent.details
                      .name_of_the_institution_attended_earlier || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Passing Percentage:</strong>{" "}
                    {selectedStudent.details.passsing_percentage || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Board Name:</strong>{" "}
                    {selectedStudent.details.board_name || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Passing Year:</strong>{" "}
                    {selectedStudent.details.passing_year || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>XII Stream:</strong>{" "}
                    {selectedStudent.details.xii_stream || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>XII Max Marks:</strong>{" "}
                    {selectedStudent.details.xii_max_marks || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>XII Marks Obtained:</strong>{" "}
                    {selectedStudent.details.xii_marks_obtained || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>XII Subject Combination:</strong>{" "}
                    {selectedStudent.details.xii_sub_combination || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>XII Passing Class:</strong>{" "}
                    {selectedStudent.details.xii_passing_class || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>PWD Category and Percentage:</strong>{" "}
                    {selectedStudent.details.pwd_category_and_Percentage ||
                      "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Urban/Rural Category:</strong>{" "}
                    {selectedStudent.details.urban_rural_category || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Created At:</strong>{" "}
                    {selectedStudent.details.created_at
                      ? new Date(
                          selectedStudent.details.created_at
                        ).toLocaleString()
                      : "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Is Active:</strong>{" "}
                    {selectedStudent.details.is_active !== undefined
                      ? selectedStudent.details.is_active
                        ? "Yes"
                        : "No"
                      : "N/A"}
                  </div>

                  <div className="detail-item">
                    <strong>Uploaded File ID:</strong>{" "}
                    {selectedStudent.details.uploaded_file_id || "N/A"}
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Fee Transactions</h4>
                <div className="student-list-container">
                  <table className="student-list-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Paid</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Mode</th>
                        <th>Installment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedStudent.fees &&
                      selectedStudent.fees.length > 0 ? (
                        selectedStudent.fees.map((f) => (
                          <tr key={f.fees_trans_id}>
                            <td>
                              {f.fees_paid_date
                                ? new Date(
                                    f.fees_paid_date
                                  ).toLocaleDateString()
                                : "N/A"}
                            </td>
                            <td>{f.amt_paid || "N/A"}</td>
                            <td>{f.tot_amt || "N/A"}</td>
                            <td>{f.payment_status || "N/A"}</td>
                            <td>{f.payment_mode || "N/A"}</td>
                            <td>{f.installment_no || "N/A"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6">No fee records found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Detail View Modal */}
      {isTransactionDetailViewOpen && selectedTransaction && (
        <div
          className="modal-overlay"
          onClick={() => setIsTransactionDetailViewOpen(false)}
        >
          <div
            className="modal-content large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Transaction Details: {selectedTransaction.fees_trans_id}</h3>
              <button
                onClick={() => {
                  setIsTransactionDetailViewOpen(false);
                  setIsFeesPopupOpen(true);
                }}
                className="close-button back-to-list"
              >
                &times;
              </button>
            </div>
            <div className="modal-body student-detail-view">
              <div className="detail-sections">
                <div className="detail-section">
                  <h4>Basic Information</h4>
                  <div className="detail-grid">
                    <p>
                      <strong>Registration Code:</strong>{" "}
                      {selectedTransaction.registration_code || "N/A"}
                    </p>
                    <p>
                      <strong>Student Name:</strong>{" "}
                      {selectedTransaction.student_name || "N/A"}
                    </p>
                    <p>
                      <strong>Course:</strong>{" "}
                      {selectedTransaction.course_name || "N/A"}
                    </p>
                    <p>
                      <strong>Institution:</strong>{" "}
                      {selectedTransaction.institution_code || "N/A"}
                    </p>
                    <p>
                      <strong>Division:</strong>{" "}
                      {selectedTransaction.division_name || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Payment Information</h4>
                  <div className="detail-grid">
                    <p>
                      <strong>Transaction ID:</strong>{" "}
                      {selectedTransaction.fees_trans_id || "N/A"}
                    </p>
                    <p>
                      <strong>Payment Status:</strong>{" "}
                      {selectedTransaction.payment_status || "N/A"}
                    </p>
                    <p>
                      <strong>Payment Mode:</strong>{" "}
                      {selectedTransaction.payment_mode || "N/A"}
                    </p>
                    <p>
                      <strong>Payment Option:</strong>{" "}
                      {selectedTransaction.payment_option || "N/A"}
                    </p>
                    <p>
                      <strong>Fees Category:</strong>{" "}
                      {selectedTransaction.fees_category || "N/A"}
                    </p>
                    <p>
                      <strong>Installment No:</strong>{" "}
                      {selectedTransaction.installment_no || "N/A"}
                    </p>
                    <p>
                      <strong>Total Amount:</strong> ₹
                      {formatAmount(selectedTransaction.total_amt)}
                    </p>
                    <p>
                      <strong>Amount Paid:</strong> ₹
                      {formatAmount(selectedTransaction.amount_paid)}
                    </p>
                    <p>
                      <strong>Remaining Amount:</strong> ₹
                      {formatAmount(
                        (selectedTransaction.total_amt || 0) -
                          (selectedTransaction.amount_paid || 0)
                      )}
                    </p>
                    <p>
                      <strong>Fees Paid Date:</strong>{" "}
                      {selectedTransaction.fees_paid_date || "N/A"}
                    </p>
                    <p>
                      <strong>Due Date:</strong>{" "}
                      {selectedTransaction.due_date || "N/A"}
                    </p>
                    <p>
                      <strong>Late Payment Charges:</strong> ₹
                      {formatAmount(selectedTransaction.late_payment_charges)}
                    </p>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Payment Reference Details</h4>
                  <div className="detail-grid">
                    <p>
                      <strong>Qfix Reference No:</strong>{" "}
                      {selectedTransaction.qfix_ref_no || "N/A"}
                    </p>
                    <p>
                      <strong>Payment Details:</strong>{" "}
                      {selectedTransaction.payment_details || "N/A"}
                    </p>
                    <p>
                      <strong>Payment Reference Details:</strong>{" "}
                      {selectedTransaction.payment_reference_details || "N/A"}
                    </p>
                    <p>
                      <strong>Settlement Date:</strong>{" "}
                      {selectedTransaction.settlement_date || "N/A"}
                    </p>
                    <p>
                      <strong>Bank Reference No:</strong>{" "}
                      {selectedTransaction.bank_reference_no || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
