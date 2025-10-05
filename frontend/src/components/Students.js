import React, { useState, useEffect, useMemo } from "react";
import { Doughnut, Bar, Line, PolarArea, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  RadialLinearScale,
} from "chart.js";
import "./Students.css";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  RadialLinearScale
);

const Students = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter states
  const [institutions, setInstitutions] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    batches: [],
    genders: [],
    student_categories: [],
  });
  const [selectedInstitution, setSelectedInstitution] = useState("all");
  const [selectedBatch, setSelectedBatch] = useState("all");
  const [selectedGender, setSelectedGender] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Search and modal states
  const [chartSearchTerm, setChartSearchTerm] = useState("");
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [popupData, setPopupData] = useState({
    title: "",
    students: [],
    filterParams: {},
  });
  const [popupSearchTerm, setPopupSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);

  // Enhanced blue color palette with more variations
  const blueColors = [
    "#003f5c",
    "#3f587e",
    "#3f587e",
    "#2a4b6d",
    "#6272a0",
    "#2a4b6d",
    "#828ec2",
    "#919cd3",
    "#a0aae4",
    "#afb8f5",
    "#bec7ff",
    "#cdd6ff",
    "#dce4ff",
    "#eaf2ff",
    "#f0f7ff",
    "#e6f2ff",
    "#d9ebff",
    "#cce4ff",
    "#bfddff",
    "#b3d6ff",
    "#a6cfff",
    "#99c8ff",
    "#8cc1ff",
    "#7fbaff",
    "#72b3ff",
    "#65acff",
    "#58a5ff",
    "#4b9eff",
    "#3e97ff",
    "#3190ff",
  ];

  // Function to generate blue colors with different intensities
  const getBlueColors = (count) => {
    if (count <= blueColors.length) {
      return blueColors.slice(0, count);
    }

    // If we need more colors than available, generate intermediate shades
    const colors = [];
    for (let i = 0; i < count; i++) {
      const baseIndex = i % blueColors.length;
      const nextIndex = (baseIndex + 1) % blueColors.length;
      const ratio = i / count;

      // Blend between two adjacent colors for smooth transitions
      colors.push(
        blendColors(blueColors[baseIndex], blueColors[nextIndex], ratio)
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

  // Helper function to generate gradient colors for line charts
  const getGradientColors = (ctx, color, index, total) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    const intensity = 0.3 + (0.7 * index) / total; // Vary intensity based on position
    gradient.addColorStop(
      0,
      `${color}${Math.round(intensity * 255)
        .toString(16)
        .padStart(2, "0")}`
    );
    gradient.addColorStop(1, `${color}33`);
    return gradient;
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const fetchInitialData = async () => {
      try {
        const [instRes, optionsRes] = await Promise.all([
          fetch("http://localhost:5000/institutes", {
            headers: { "x-access-token": token },
          }),
          fetch("http://localhost:5000/api/filter-options", {
            headers: { "x-access-token": token },
          }),
        ]);
        if (!instRes.ok || !optionsRes.ok)
          throw new Error("Failed to fetch initial filter data");

        const instData = await instRes.json();
        const optionsData = await optionsRes.json();

        setInstitutions(instData);
        setFilterOptions(optionsData);
      } catch (err) {
        setError("Could not load filter options.");
        console.error(err);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const token = localStorage.getItem("token");
        const params = new URLSearchParams({
          institution_code: selectedInstitution,
          batch_year: selectedBatch,
          gender: selectedGender,
          student_category: selectedCategory,
        });

        const response = await fetch(
          `http://localhost:5000/api/dashboard/students?${params.toString()}`,
          { headers: { "x-access-token": token } }
        );

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(
            errData.message || `HTTP error! status: ${response.status}`
          );
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(`Failed to fetch student data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedInstitution, selectedBatch, selectedGender, selectedCategory]);

  const chartDataSets = useMemo(() => {
    if (!data) return {};

    return {
      gender: {
        labels: (data.genderDistribution || []).map((d) => d.gender),
        datasets: [
          {
            data: (data.genderDistribution || []).map((d) => d.count),
            backgroundColor: getBlueColors(
              (data.genderDistribution || []).length
            ),
          },
        ],
      },
      category: {
        labels: (data.categoryDistribution || []).map(
          (d) => d.student_category
        ),
        datasets: [
          {
            data: (data.categoryDistribution || []).map((d) => d.count),
            backgroundColor: getBlueColors(
              (data.categoryDistribution || []).length
            ),
          },
        ],
      },
      religion: {
        labels: (data.religionDistribution || []).map((d) => d.religion),
        datasets: [
          {
            label: "Students",
            data: (data.religionDistribution || []).map((d) => d.count),
            backgroundColor: getBlueColors(
              (data.religionDistribution || []).length
            ),
          },
        ],
      },
      stream: {
        labels: (data.streamDistribution || []).map((d) => d.stream),
        datasets: [
          {
            label: "Students",
            data: (data.streamDistribution || []).map((d) => d.count),
            backgroundColor: getBlueColors(
              (data.streamDistribution || []).length
            ),
          },
        ],
      },
      class: {
        labels: (data.classDistribution || []).map((d) => d.class),
        datasets: [
          {
            label: "Students",
            data: (data.classDistribution || []).map((d) => d.count),
            backgroundColor: getBlueColors(
              (data.classDistribution || []).length
            ),
          },
        ],
      },
      state: {
        labels: (data.stateDistribution || []).map((d) => d.state),
        datasets: [
          {
            label: "Students",
            data: (data.stateDistribution || []).map((d) => d.count),
            backgroundColor: getBlueColors(
              (data.stateDistribution || []).length
            ),
          },
        ],
      },
      bloodGroup: {
        labels: (data.bloodGroupDistribution || []).map((d) => d.blood_group),
        datasets: [
          {
            data: (data.bloodGroupDistribution || []).map((d) => d.count),
            backgroundColor: getBlueColors(
              (data.bloodGroupDistribution || []).length
            ),
          },
        ],
      },
      fathersOccupation: {
        labels: (data.fathersOccupationDistribution || []).map(
          (d) => d.fathers_occupation
        ),
        datasets: [
          {
            label: "Count",
            data: (data.fathersOccupationDistribution || []).map(
              (d) => d.count
            ),
            borderColor: blueColors[8],
            backgroundColor: (ctx) => {
              const colors = getBlueColors(
                (data.fathersOccupationDistribution || []).length
              );
              return getGradientColors(ctx.chart.ctx, colors[0], 0, 1);
            },
            fill: true,
            tension: 0.4,
          },
        ],
      },
      mothersOccupation: {
        labels: (data.mothersOccupationDistribution || []).map(
          (d) => d.mothers_occupation
        ),
        datasets: [
          {
            label: "Count",
            data: (data.mothersOccupationDistribution || []).map(
              (d) => d.count
            ),
            borderColor: blueColors[9],
            backgroundColor: (ctx) => {
              const colors = getBlueColors(
                (data.mothersOccupationDistribution || []).length
              );
              return getGradientColors(ctx.chart.ctx, colors[0], 0, 1);
            },
            fill: true,
            tension: 0.4,
          },
        ],
      },
      age: {
        labels: (data.ageDistribution || []).map((d) => d.age_group),
        datasets: [
          {
            label: "Students",
            data: (data.ageDistribution || []).map((d) => d.count),
            borderColor: blueColors[7],
            backgroundColor: (ctx) => {
              const colors = getBlueColors((data.ageDistribution || []).length);
              return getGradientColors(ctx.chart.ctx, colors[0], 0, 1);
            },
            fill: true,
            tension: 0.4,
          },
        ],
      },
      motherTongue: {
        labels: (data.motherTongueDistribution || []).map(
          (d) => d.mother_tongue
        ),
        datasets: [
          {
            label: "Students",
            data: (data.motherTongueDistribution || []).map((d) => d.count),
            backgroundColor: getBlueColors(
              (data.motherTongueDistribution || []).length
            ),
          },
        ],
      },
      urbanRural: {
        labels: (data.urbanRuralDistribution || []).map(
          (d) => d.urban_rural_category
        ),
        datasets: [
          {
            data: (data.urbanRuralDistribution || []).map((d) => d.count),
            backgroundColor: getBlueColors(
              (data.urbanRuralDistribution || []).length
            ),
          },
        ],
      },
      previousSchool: {
        labels: (data.previousSchoolDistribution || []).map(
          (d) => d.name_of_the_institution_attended_earlier
        ),
        datasets: [
          {
            label: "Students",
            data: (data.previousSchoolDistribution || []).map((d) => d.count),
            backgroundColor: getBlueColors(
              (data.previousSchoolDistribution || []).length
            ),
          },
        ],
      },
      classSectionStream: {
        labels: (data.classSectionStreamDistribution || []).map((d) =>
          `${d.class || ""} ${d.section || ""} ${d.stream || ""}`.trim()
        ),
        datasets: [
          {
            label: "Students",
            data: (data.classSectionStreamDistribution || []).map(
              (d) => d.count
            ),
            backgroundColor: getBlueColors(
              (data.classSectionStreamDistribution || []).length
            ),
            barThickness: 20,
          },
        ],
      },
      pincode: {
        labels: (data.pincodeDistribution || []).map((d) => d.pin_code),
        datasets: [
          {
            label: "Students",
            data: (data.pincodeDistribution || []).map((d) => d.count),
            backgroundColor: getBlueColors(
              (data.pincodeDistribution || []).length
            ),
          },
        ],
      },
      city: {
        labels: (data.cityDistribution || []).map((d) => d.city),
        datasets: [
          {
            label: "Students",
            data: (data.cityDistribution || []).map((d) => d.count),
            backgroundColor: getBlueColors(
              (data.cityDistribution || []).length
            ),
          },
        ],
      },
    };
  }, [data]);

  const handleChartClick = async (filterType, chartData, element) => {
    if (!element.length) return;
    const index = element[0].index;
    const filterValue = chartData.labels[index];

    setLoading(true);
    const filterParams = {
      filterType,
      filterValue,
      institution_code: selectedInstitution,
      batch_year: selectedBatch,
      gender: selectedGender,
      student_category: selectedCategory,
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
      setPopupData({
        title: `${filterType.replace(/_/g, " ")}: ${filterValue}`,
        students,
        filterParams,
      });
      setIsPopupOpen(true);
    } catch (err) {
      setError(`Could not load student list. ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

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
      setIsPopupOpen(false);
      setIsDetailViewOpen(true);
    } catch (err) {
      setError(`Could not load student details. ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const exportData = async (format, data) => {
    if (format === "excel") {
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
    }
  };

  const chartList = useMemo(
    () => [
      {
        id: "gender",
        title: "Gender Distribution",
        type: "Doughnut",
        data: chartDataSets.gender,
        filterKey: "gender",
      },
      {
        id: "category",
        title: "Student Category",
        type: "Doughnut",
        data: chartDataSets.category,
        filterKey: "student_category",
      },
      {
        id: "urbanRural",
        title: "Urban / Rural",
        type: "Pie",
        data: chartDataSets.urbanRural,
        filterKey: "urban_rural_category",
      },
      {
        id: "religion",
        title: "Religion Distribution",
        type: "Bar",
        data: chartDataSets.religion,
        filterKey: "religion",
      },
      {
        id: "stream",
        title: "Stream Enrollment",
        type: "Bar",
        data: chartDataSets.stream,
        options: {
          indexAxis: "y",
          scales: {
            y: {
              ticks: {
                font: {
                  size: 10, // Reduced font size for y-axis labels
                },
              },
            },
            x: {
              ticks: {
                font: {
                  size: 10, // Reduced font size for x-axis values
                },
              },
            },
          },
        },
        filterKey: "stream",
      },
      {
        id: "class",
        title: "Class Distribution",
        type: "Bar",
        data: chartDataSets.class,
        filterKey: "class",
      },
      {
        id: "state",
        title: "State Distribution",
        type: "Bar",
        data: chartDataSets.state,
        filterKey: "state",
      },
      {
        id: "city",
        title: "City Distribution",
        type: "Bar",
        data: chartDataSets.city,
        filterKey: "city",
      },
      {
        id: "pincode",
        title: "Pincode Distribution",
        type: "Bar",
        data: chartDataSets.pincode,
        filterKey: "pin_code",
      },
      {
        id: "motherTongue",
        title: "Mother Tongue",
        type: "Bar",
        data: chartDataSets.motherTongue,
        options: { indexAxis: "y" },
        filterKey: "mother_tongue",
      },
      {
        id: "bloodGroup",
        title: "Blood Group",
        type: "PolarArea",
        data: chartDataSets.bloodGroup,
        filterKey: "blood_group",
      },
      {
        id: "fathersOccupation",
        title: "Father's Occupation",
        type: "Line",
        data: chartDataSets.fathersOccupation,
        filterKey: "fathers_occupation",
      },
      {
        id: "mothersOccupation",
        title: "Mother's Occupation",
        type: "Line",
        data: chartDataSets.mothersOccupation,
        filterKey: "mothers_occupation",
      },
      {
        id: "age",
        title: "Age Groups",
        type: "Line",
        data: chartDataSets.age,
        filterKey: "age_group", // This will now work with the backend fix
      },
      {
        id: "previousSchool",
        title: "Previous Schools",
        type: "Bar",
        data: chartDataSets.previousSchool,
        options: { indexAxis: "y" },
        filterKey: "name_of_the_institution_attended_earlier",
        size: "large",
      },
    ],
    [chartDataSets]
  );

  const filteredCharts = useMemo(() => {
    if (!chartSearchTerm) return chartList;
    return chartList.filter((chart) =>
      chart.title.toLowerCase().includes(chartSearchTerm.toLowerCase())
    );
  }, [chartSearchTerm, chartList]);

  // Filtering logic for popups
  const filteredPopupStudents = useMemo(() => {
    if (!popupSearchTerm) return popupData.students;
    return popupData.students.filter((s) =>
      Object.values(s).some((v) =>
        String(v).toLowerCase().includes(popupSearchTerm.toLowerCase())
      )
    );
  }, [popupSearchTerm, popupData.students]);

  if (loading && !isPopupOpen && !isDetailViewOpen)
    return (
      <div className="loading-indicator">Loading Student Analytics...</div>
    );
  if (error) return <div className="error-message">{error}</div>;
  if (!data || !data.kpis)
    return <div className="error-message">No student data available.</div>;

  const renderChart = ({
    id,
    title,
    type,
    data,
    options = {},
    filterKey,
    size,
  }) => {
    // Return null if no data is available
    if (!data || !data.labels || data.labels.length === 0) return null;

    const ChartComponent = { Doughnut, Bar, Line, PolarArea, Pie }[type];
    const cardClass = size === "large" ? "chart-card-large" : "chart-card";

    return (
      <div key={id} className={cardClass}>
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
              onClick: (evt, el) => handleChartClick(filterKey, data, el),
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="students-dashboard-container">
      <div className="header-container">
        <h2>Student Analytics</h2>

        <div className="search-bar-container">
          <input
            type="text"
            placeholder="Search for charts..."
            className="search-input"
            value={chartSearchTerm}
            onChange={(e) => setChartSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="filters-bar">
        <div className="filter-group">
          <label>Institution</label>
          <select
            value={selectedInstitution}
            onChange={(e) => setSelectedInstitution(e.target.value)}
          >
            <option value="all">All Institutions</option>
            {institutions.map((i) => (
              <option key={i.institution_code} value={i.institution_code}>
                {i.institute_name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Batch</label>
          <select
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
          >
            <option value="all">All Batches</option>
            {filterOptions.batches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <button
          className="advanced-filters-btn"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
        >
          {showAdvancedFilters ? "Hide" : "Show"} Advanced Filters
        </button>
      </div>

      {showAdvancedFilters && (
        <div className="advanced-filters-panel">
          <div className="filter-group">
            <label>Gender</label>
            <select
              value={selectedGender}
              onChange={(e) => setSelectedGender(e.target.value)}
            >
              <option value="all">All Genders</option>
              {filterOptions.genders.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              {filterOptions.student_categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="kpi-grid">
        <div
          className="kpi-card"
          onClick={() =>
            handleChartClick("all", { labels: ["all"] }, [{ index: 0 }])
          }
        >
          <div className="kpi-info">
            <div className="kpi-value">
              {data.kpis.total_students.toLocaleString()}
            </div>
            <div className="kpi-label">Total Students</div>
          </div>
        </div>
        <div
          className="kpi-card male"
          onClick={() =>
            handleChartClick("gender", { labels: ["Male"] }, [{ index: 0 }])
          }
        >
          <div className="kpi-info">
            <div className="kpi-value">
              {data.kpis.male_students.toLocaleString()}
            </div>
            <div className="kpi-label">Male Students</div>
          </div>
        </div>
        <div
          className="kpi-card female"
          onClick={() =>
            handleChartClick("gender", { labels: ["Female"] }, [{ index: 0 }])
          }
        >
          <div className="kpi-info">
            <div className="kpi-value">
              {data.kpis.female_students.toLocaleString()}
            </div>
            <div className="kpi-label">Female Students</div>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        {filteredCharts.length > 0 ? (
          filteredCharts.map(renderChart)
        ) : (
          <p>No charts match your search.</p>
        )}
      </div>

      {isPopupOpen && (
        <div className="modal-overlay" onClick={() => setIsPopupOpen(false)}>
          <div
            className="modal-content full-width"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{popupData.title}</h3>
              <button
                onClick={() => setIsPopupOpen(false)}
                className="close-button"
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-controls">
                <button
                  onClick={() => exportData("excel", filteredPopupStudents)}
                  className="export-btn"
                >
                  Export Excel
                </button>
                <input
                  type="text"
                  placeholder="Search..."
                  className="modal-search"
                  value={popupSearchTerm}
                  onChange={(e) => setPopupSearchTerm(e.target.value)}
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
                    {filteredPopupStudents.map((s) => (
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

      {isDetailViewOpen && selectedStudent && (
        <div
          className="modal-overlay"
          onClick={() => setIsDetailViewOpen(false)}
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
                    setIsDetailViewOpen(false);
                    setIsPopupOpen(true);
                  }}
                  className="close-button back-to-list"
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="modal-body student-detail-view">
              <div className="detail-section">
                <h4>Personal Information</h4>
                <div className="detail-grid">
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
    </div>
  );
};

export default Students;
