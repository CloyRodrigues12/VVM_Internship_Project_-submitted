import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Doughnut, Bar, Line, Pie } from "react-chartjs-2";
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
} from "chart.js";
import "./Fees.css";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler
);

const Fees = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter states
  const [institutions, setInstitutions] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    batches: [],
    payment_statuses: [],
    payment_modes: [],
    payment_options: [],
    courses: [],
    divisions: []
  });
  const [selectedInstitution, setSelectedInstitution] = useState("all");
  const [selectedBatch, setSelectedBatch] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedMode, setSelectedMode] = useState("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Date range filter states - now with temporary values and applied values
  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");
  const [dateFilterChanged, setDateFilterChanged] = useState(false);

  // Search and modal states
  const [chartSearchTerm, setChartSearchTerm] = useState("");
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [popupData, setPopupData] = useState({
    title: "",
    transactions: [],
    filterParams: {},
  });
  const [popupSearchTerm, setPopupSearchTerm] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);

  // Revenue detail states
  const [revenueDetailData, setRevenueDetailData] = useState(null);
  const [isRevenueDetailOpen, setIsRevenueDetailOpen] = useState(false);

  // Daily trend title state
  const [dailyTransactionTrendTitle, setDailyTransactionTrendTitle] = useState("Daily Transaction Trend (Current Week)");

  // Modal history stack
  const [modalHistory, setModalHistory] = useState([]);

  // Blue color palette
  const blueColors = [
    "#003f5c", "#3f587e", "#3f587e", "#2a4b6d", "#6272a0",
    "#2a4b6d", "#828ec2", "#919cd3", "#a0aae4", "#afb8f5",
    "#bec7ff", "#cdd6ff", "#dce4ff", "#eaf2ff", "#f0f7ff",
    "#e6f2ff", "#d9ebff", "#cce4ff", "#bfddff", "#b3d6ff",
    "#a6cfff", "#99c8ff", "#8cc1ff", "#7fbaff", "#72b3ff",
    "#65acff", "#58a5ff", "#4b9eff", "#3e97ff", "#3190ff"
  ];

 
  // Helper function to safely format amounts in Indian numbering system
// Helper function to safely format amounts in Indian numbering system
const formatAmount = (amount) => {
  if (amount === null || amount === undefined) return '0';
  
  // Convert to number if it's a string
  let num;
  if (typeof amount === 'string') {
    num = parseFloat(amount);
    if (isNaN(num)) return '0';
  } else {
    num = amount;
  }
  
  // Use Indian locale formatting for numbers
  return num.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
    useGrouping: true
  });

  
  // Handle negative numbers
  const isNegative = num < 0;
  num = Math.abs(num);
  
  // Indian numbering system: 1,00,00,000 format
  if (num >= 10000000) {
    // Crores: 1,00,00,000
    const crores = Math.floor(num / 10000000);
    const lakhs = Math.floor((num % 10000000) / 100000);
    const thousands = Math.floor((num % 100000) / 1000);
    const hundreds = Math.floor(num % 1000);
    
    let result = crores.toLocaleString("en-IN");
    
    if (lakhs > 0) {
      result += ',' + lakhs.toString().padStart(2, '0');
    } else {
      result += ',00';
    }
    
    if (thousands > 0) {
      result += ',' + thousands.toString().padStart(2, '0');
    } else {
      result += ',00';
    }
    
    if (hundreds > 0) {
      result += ',' + hundreds.toString().padStart(3, '0');
    } else {
      result += ',000';
    }
    
    return isNegative ? '-' + result : result;
  } else if (num >= 100000) {
    // Lakhs: 1,00,000
    const lakhs = Math.floor(num / 100000);
    const thousands = Math.floor((num % 100000) / 1000);
    const hundreds = Math.floor(num % 1000);
    
    let result = lakhs.toLocaleString("en-IN");
    
    if (thousands > 0) {
      result += ',' + thousands.toString().padStart(2, '0');
    } else {
      result += ',00';
    }
    
    if (hundreds > 0) {
      result += ',' + hundreds.toString().padStart(3, '0');
    } else {
      result += ',000';
    }
    
    return isNegative ? '-' + result : result;
  } else if (num >= 1000) {
    // Thousands: 1,000
    const thousands = Math.floor(num / 1000);
    const hundreds = Math.floor(num % 1000);
    
    let result = thousands.toLocaleString("en-IN");
    
    if (hundreds > 0) {
      result += ',' + hundreds.toString().padStart(3, '0');
    } else {
      result += ',000';
    }
    
    return isNegative ? '-' + result : result;
  } else {
    // Less than 1000
    return isNegative ? '-' + Math.floor(num).toString() : Math.floor(num).toString();
  }
};

  // Helper function to get week number
  const getWeekNumber = (date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const fetchInitialData = async () => {
      try {
        const [instRes, optionsRes] = await Promise.all([
          fetch("http://localhost:5000/institutes", {
            headers: { "x-access-token": token },
          }),
          fetch("http://localhost:5000/api/fees/filter-options", {
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
      }
    };
    fetchInitialData();
  }, []);

  // Debounce function to prevent too many API calls
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        institution_code: selectedInstitution,
        batch_year: selectedBatch,
        payment_status: selectedStatus,
        payment_mode: selectedMode,
      });

      // Use applied date values instead of temp values
      if (appliedStartDate) {
        params.append('start_date', appliedStartDate);
      }
      if (appliedEndDate) {
        params.append('end_date', appliedEndDate);
      }

      const response = await fetch(
        `http://localhost:5000/api/dashboard/fees?${params.toString()}`,
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
      setError(`Failed to fetch fees data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedInstitution, selectedBatch, selectedStatus, selectedMode, appliedStartDate, appliedEndDate]);

  // Debounced version of fetchData
  const debouncedFetchData = useMemo(() => debounce(fetchData, 300), [fetchData]);

  useEffect(() => {
    debouncedFetchData();
  }, [selectedInstitution, selectedBatch, selectedStatus, selectedMode, appliedStartDate, appliedEndDate, debouncedFetchData]);

  // Update daily trend title based on data
  useEffect(() => {
  if (data && data.dailyTransactionTrend && data.dailyTransactionTrend.length > 0) {
    // Get the date range from the applied filters or use current month as default
    let title = "Daily Transaction Trend";
    
    if (appliedStartDate || appliedEndDate) {
      // Format dates for display
      const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
      };
      
      const start = appliedStartDate ? formatDate(appliedStartDate) : "Start";
      const end = appliedEndDate ? formatDate(appliedEndDate) : "End";
      
      title = `Daily Transaction Trend (${start} - ${end})`;
    } else {
      // No date filters applied, show current month
      const today = new Date();
      const monthName = today.toLocaleDateString('en-US', { month: 'long' });
      title = `Daily Transaction Trend (${monthName})`;
    }
    
    setDailyTransactionTrendTitle(title);
  } else {
    // Show appropriate title even if no data
    let title = "Daily Transaction Trend";
    
    if (appliedStartDate || appliedEndDate) {
      const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
      };
      
      const start = appliedStartDate ? formatDate(appliedStartDate) : "Start";
      const end = appliedEndDate ? formatDate(appliedEndDate) : "End";
      
      title = `Daily Transaction Trend (${start} - ${end})`;
    } else {
      const today = new Date();
      const monthName = today.toLocaleDateString('en-US', { month: 'long' });
      title = `Daily Transaction Trend (${monthName})`;
    }
    
    setDailyTransactionTrendTitle(title);
  }
}, [data, appliedStartDate, appliedEndDate]);
  // Apply date filters when both dates are selected or when user stops typing
  useEffect(() => {
    if (dateFilterChanged) {
      const timer = setTimeout(() => {
        setAppliedStartDate(tempStartDate);
        setAppliedEndDate(tempEndDate);
        setDateFilterChanged(false);
      }, 800); // Apply after 800ms of inactivity
      
      return () => clearTimeout(timer);
    }
  }, [tempStartDate, tempEndDate, dateFilterChanged]);

  const handleDateChange = (type, value) => {
    if (type === 'start') {
      setTempStartDate(value);
    } else {
      setTempEndDate(value);
    }
    setDateFilterChanged(true);
  };

  // Function to open a modal and add to history
  const openModal = (modalType, modalData) => {
    setModalHistory(prev => [...prev, { type: modalType, data: modalData }]);
    
    if (modalType === 'popup') {
      setIsPopupOpen(true);
      setPopupData(modalData);
      setIsDetailViewOpen(false);
      setIsRevenueDetailOpen(false);
    } else if (modalType === 'detail') {
      setIsDetailViewOpen(true);
      setSelectedTransaction(modalData);
      setIsPopupOpen(false);
      setIsRevenueDetailOpen(false);
    } else if (modalType === 'revenue') {
      setIsRevenueDetailOpen(true);
      setRevenueDetailData(modalData);
      setIsPopupOpen(false);
      setIsDetailViewOpen(false);
    }
  };

  // Function to go back to previous modal
  const goBackToPreviousModal = () => {
    if (modalHistory.length <= 1) {
      // If only one modal in history, close all modals
      closeAllModals();
      return;
    }
    
    // Remove current modal from history
    const newHistory = [...modalHistory];
    newHistory.pop();
    setModalHistory(newHistory);
    
    // Get the previous modal
    const previousModal = newHistory[newHistory.length - 1];
    
    // Show the previous modal
    if (previousModal.type === 'popup') {
      setIsPopupOpen(true);
      setPopupData(previousModal.data);
      setIsDetailViewOpen(false);
      setIsRevenueDetailOpen(false);
    } else if (previousModal.type === 'detail') {
      setIsDetailViewOpen(true);
      setSelectedTransaction(previousModal.data);
      setIsPopupOpen(false);
      setIsRevenueDetailOpen(false);
    } else if (previousModal.type === 'revenue') {
      setIsRevenueDetailOpen(true);
      setRevenueDetailData(previousModal.data);
      setIsPopupOpen(false);
      setIsDetailViewOpen(false);
    }
  };

  // Function to close all modals
  const closeAllModals = () => {
    setIsPopupOpen(false);
    setIsDetailViewOpen(false);
    setIsRevenueDetailOpen(false);
    setModalHistory([]);
  };

  const handleChartClick = async (filterType, chartData, element, chartId) => {
    if (!element.length) return;
    const index = element[0].index;
    const filterValue = chartData.labels[index];
    
    // Handle special cases for different chart types
    let actualFilterType = filterType;
    let actualFilterValue = filterValue;
    let additionalFilters = {};
    
    // Special handling for different chart types
    if (chartId === 'courseRevenue') {
      // For course revenue, show only paid students of that course
      additionalFilters.payment_status = 'PAID';
    } else if (chartId === 'dailyTransactionTrend') {
      // For daily trend, show students who paid on that specific day
      actualFilterType = 'fees_paid_date';
      additionalFilters.payment_status = 'PAID';
    } else if (chartId === 'institutionRevenue') {
      // For institution revenue, show paid students of that institution
      additionalFilters.payment_status = 'PAID';
    } else if (chartId === 'monthlyRevenue') {
      // For monthly trend, show students who paid in that month
      actualFilterType = 'month_range';
      additionalFilters.payment_status = 'PAID';
    } else if (chartId === 'dueDateStatus') {
      // For due date status, special handling for overdue unpaid
      if (filterValue === 'Overdue Unpaid') {
        actualFilterType = 'due_date_status';
        additionalFilters.payment_status = 'UNPAID,PARTIAL_PAID';
      } else {
        // For other statuses, use the default filter
        actualFilterType = 'due_date_status';
      }
    }

    setLoading(true);
    const filterParams = {
      filterType: actualFilterType,
      filterValue: actualFilterValue,
      institution_code: selectedInstitution,
      batch_year: selectedBatch,
      payment_mode: selectedMode,
      ...additionalFilters
    };

    // Use applied date values
    if (appliedStartDate) {
      filterParams.start_date = appliedStartDate;
    }
    if (appliedEndDate) {
      filterParams.end_date = appliedEndDate;
    }

    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams(filterParams);
      const response = await fetch(
        `http://localhost:5000/api/transactions/list?${params.toString()}`,
        { headers: { "x-access-token": token } }
      );
      if (!response.ok) throw new Error("Failed to fetch transaction list");
      const transactions = await response.json();
      
      let displayTitle = `${actualFilterType.replace(/_/g, " ")}: ${actualFilterValue}`;
      
      // Special formatting for date-based filters
      if (actualFilterType === 'fees_paid_date') {
        displayTitle = `Date: ${new Date(actualFilterValue).toLocaleDateString()}`;
      } else if (actualFilterType === 'month_range') {
        displayTitle = `Month: ${actualFilterValue}`;
      }
      
      openModal('popup', {
        title: displayTitle,
        transactions,
        filterParams,
      });
    } catch (err) {
      setError(`Could not load transaction list. ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRevenueChartClick = async (filterType, chartData, element, chartId) => {
    if (!element.length) return;
    const index = element[0].index;
    const filterValue = chartData.labels[index];
    
    // Only show detailed view for revenue charts
    if (!['courseRevenue', 'institutionRevenue', 'monthlyRevenue'].includes(chartId)) {
      return;
    }
    
    setLoading(true);
    const filterParams = {
      filterType,
      filterValue,
      institution_code: selectedInstitution,
      batch_year: selectedBatch,
      payment_status: 'PAID', // Only show paid transactions for revenue details
      payment_mode: selectedMode,
    };

    // Use applied date values
    if (appliedStartDate) {
      filterParams.start_date = appliedStartDate;
    }
    if (appliedEndDate) {
      filterParams.end_date = appliedEndDate;
    }

    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams(filterParams);
      
      // Fetch detailed revenue data
      const response = await fetch(
        `http://localhost:5000/api/transactions/revenue-details?${params.toString()}`,
        { headers: { "x-access-token": token } }
      );
      
      if (!response.ok) throw new Error("Failed to fetch revenue details");
      const revenueData = await response.json();
      
      openModal('revenue', {
        title: `${filterType.replace(/_/g, " ")}: ${filterValue}`,
        summary: revenueData.summary,
        transactions: revenueData.transactions,
        filterParams,
      });
    } catch (err) {
      setError(`Could not load revenue details. ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // New function to handle KPI clicks
  const handleKpiClick = async (kpiType) => {
    setLoading(true);
    
    // Set filter parameters based on KPI type
    const filterParams = {
      institution_code: selectedInstitution,
      batch_year: selectedBatch,
      payment_mode: selectedMode,
    };

    // Use applied date values
    if (appliedStartDate) {
      filterParams.start_date = appliedStartDate;
    }
    if (appliedEndDate) {
      filterParams.end_date = appliedEndDate;
    }

    // Set payment status filter based on KPI type
    switch(kpiType) {
      case 'total_amount':
        // All students - no payment status filter
        break;
      case 'total_paid':
        filterParams.payment_status = 'PAID';
        break;
      case 'total_unpaid':
        filterParams.payment_status = 'UNPAID,PARTIAL_PAID';
        break;
      case 'total_transactions':
        // All transactions - no payment status filter
        break;
      case 'successful_transactions':
        filterParams.payment_status = 'PAID';
        break;
      case 'pending_transactions':
        filterParams.payment_status = 'UNPAID,PARTIAL_PAID';
        break;
      case 'refunded_transactions':
        filterParams.payment_status = 'REFUNDED';
        break;
      case 'total_refunded':
        filterParams.payment_status = 'REFUNDED';
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
      let title = '';
      switch(kpiType) {
        case 'total_amount':
          title = 'All Students';
          break;
        case 'total_paid':
          title = 'Paid Students';
          break;
        case 'total_unpaid':
          title = 'Unpaid/Partially Paid Students';
          break;
        case 'total_transactions':
          title = 'All Transactions';
          break;
        case 'successful_transactions':
          title = 'Successful Transactions (PAID)';
          break;
        case 'pending_transactions':
          title = 'Pending Transactions (UNPAID/PARTIAL_PAID)';
          break;
        case 'refunded_transactions':
          title = 'Refunded Transactions';
          break;
        case 'total_refunded':
          title = 'Total Refunded Amount Transactions';
          break;
        default:
          title = 'Transaction List';
      }
      
      openModal('popup', {
        title,
        transactions,
        filterParams,
      });
    } catch (err) {
      setError(`Could not load transaction list. ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleViewTransactionDetails = (transaction) => {
    openModal('detail', transaction);
  };

  const exportData = async (data) => {
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

  const clearDateFilters = () => {
    setTempStartDate("");
    setTempEndDate("");
    setAppliedStartDate("");
    setAppliedEndDate("");
  };

  const chartDataSets = useMemo(() => {
    if (!data) return {};
    
    // Helper function to get blue colors for datasets
    const getBlueColors = (count) => {
      return blueColors.slice(0, count);
    };
    
    return {
      paymentStatus: {
        labels: (data.paymentStatusDistribution || []).map((d) => d.label),
        datasets: [
          {
            data: (data.paymentStatusDistribution || []).map((d) => d.count),
            backgroundColor: getBlueColors((data.paymentStatusDistribution || []).length),
          },
        ],
      },
      paymentMode: {
        labels: (data.paymentModeDistribution || []).map((d) => d.label),
        datasets: [
          {
            data: (data.paymentModeDistribution || []).map((d) => d.count),
            backgroundColor: getBlueColors((data.paymentModeDistribution || []).length),
          },
        ],
      },
      courseRevenue: {
        labels: (data.courseRevenueDistribution || []).map((d) => d.label),
        datasets: [
          {
            label: "Revenue",
            data: (data.courseRevenueDistribution || []).map((d) => d.amount),
            backgroundColor: blueColors[0], // Use the first blue color
          },
        ],
      },
      installment: {
        labels: (data.installmentDistribution || []).map((d) => d.label),
        datasets: [
          {
            label: "Transactions",
            data: (data.installmentDistribution || []).map((d) => d.count),
            backgroundColor: blueColors[5], // Use a specific blue
          },
        ],
      },
      monthlyRevenue: {
        labels: (data.monthlyRevenueTrend || []).map((d) => d.label),
        datasets: [
          {
            label: "Revenue",
            data: (data.monthlyRevenueTrend || []).map((d) => d.amount),
            borderColor: blueColors[10],
            backgroundColor: "rgba(0, 63, 92, 0.2)", // First blue with opacity
            fill: true,
          },
        ],
      },
      feeComponents: {
        labels: (data.feeComponentsDistribution || []).map((d) => d.label),
        datasets: [
          {
            label: "Amount",
            data: (data.feeComponentsDistribution || []).map((d) => d.amount),
            backgroundColor: blueColors[15], // Use a specific blue
          },
        ],
      },
      dailyTransactionTrend: {
        labels: (data.dailyTransactionTrend || []).map((d) => d.label),
        datasets: [
          {
            label: "Transactions",
            data: (data.dailyTransactionTrend || []).map((d) => d.count),
            borderColor: blueColors[20],
            backgroundColor: "rgba(0, 63, 92, 0.2)",
            fill: true,
          },
          {
            label: "Amount",
            data: (data.dailyTransactionTrend || []).map((d) => d.amount),
            borderColor: blueColors[25],
            backgroundColor: "rgba(58, 75, 109, 0.2)",
            fill: true,
          }
        ],
      },
      institutionRevenue: {
        labels: (data.institutionRevenueDistribution || []).map((d) => d.label),
        datasets: [
          {
            label: "Revenue",
            data: (data.institutionRevenueDistribution || []).map((d) => d.amount),
            backgroundColor: getBlueColors((data.institutionRevenueDistribution || []).length),
          },
        ],
      },
      paymentOption: {
        labels: (data.paymentOptionDistribution || []).map((d) => d.label),
        datasets: [
          {
            label: "Count",
            data: (data.paymentOptionDistribution || []).map((d) => d.count),
            backgroundColor: getBlueColors((data.paymentOptionDistribution || []).length),
          },
        ],
      },
      dueDateStatus: {
        labels: (data.dueDateStatusDistribution || []).map((d) => d.status),
        datasets: [
          {
            label: "Count",
            data: (data.dueDateStatusDistribution || []).map((d) => d.count),
            backgroundColor: getBlueColors((data.dueDateStatusDistribution || []).length),
          },
        ],
      },
    };
  }, [data]);

  const chartList = useMemo(
    () => [
      {
        id: "paymentStatus",
        title: "Payment Status Distribution",
        type: "Doughnut",
        data: chartDataSets.paymentStatus,
        filterKey: "payment_status",
      },
      {
        id: "paymentMode",
        title: "Payment Mode Distribution",
        type: "Pie",
        data: chartDataSets.paymentMode,
        filterKey: "payment_mode",
      },
      {
        id: "courseRevenue",
        title: "Course-wise Revenue Distribution",
        type: "Bar",
        data: chartDataSets.courseRevenue,
        filterKey: "course_name",
      },
      {
        id: "installment",
        title: "Installment Distribution",
        type: "Bar",
        data: chartDataSets.installment,
        options: { indexAxis: "y" },
        filterKey: "installment_no",
      },
      {
        id: "feeComponents",
        title: "Fee Components Breakdown",
        type: "Bar",
        data: chartDataSets.feeComponents,
        size: "large",
        options: { indexAxis: "y" },
        filterKey: null,
      },
      {
        id: "dailyTransactionTrend",
        title: dailyTransactionTrendTitle,
        type: "Line",
        data: chartDataSets.dailyTransactionTrend,
        size: "large",
        filterKey: "date",
      },
      {
        id: "institutionRevenue",
        title: "Institution-wise Revenue",
        type: "Bar",
        data: chartDataSets.institutionRevenue,
        filterKey: "institution_code",
      },
      {
        id: "paymentOption",
        title: "Payment Option Distribution",
        type: "Bar",
        data: chartDataSets.paymentOption,
        options: { indexAxis: "y" },
        filterKey: "payment_option",
      },
      {
        id: "monthlyRevenue",
        title: "Monthly Revenue Trend (Current Year)",
        type: "Line",
        data: chartDataSets.monthlyRevenue,
        size: "large",
        filterKey: "month",
      },
      {
        id: "dueDateStatus",
        title: "Due Date Status",
        type: "Bar",
        data: chartDataSets.dueDateStatus,
        size: "medium",
        filterKey: "due_date_status",
      },
    ],
    [chartDataSets, dailyTransactionTrendTitle]
  );

  const filteredCharts = useMemo(() => {
    if (!chartSearchTerm) return chartList;
    return chartList.filter((chart) =>
      chart.title.toLowerCase().includes(chartSearchTerm.toLowerCase())
    );
  }, [chartSearchTerm, chartList]);

  const filteredPopupTransactions = useMemo(() => {
    if (!popupSearchTerm) return popupData.transactions;
    return popupData.transactions.filter((t) =>
      Object.values(t).some((v) =>
        String(v).toLowerCase().includes(popupSearchTerm.toLowerCase())
      )
    );
  }, [popupSearchTerm, popupData.transactions]);

  const renderChart = ({
  id,
  title,
  type,
  data,
  options = {},
  filterKey,
  size,
}) => {
  const ChartComponent = { Doughnut, Bar, Line, Pie }[type];
  const cardClass = size === "large" ? "chart-card-large" : size === "medium" ? "chart-card-medium" : "chart-card";
  
  // Return null if no data is available
  if (!data || !data.labels || data.labels.length === 0) return null;
  
  // Determine which handler to use
  const onClickHandler = (evt, el) => handleChartClick(filterKey, data, el, id);
  
  return (
    <div key={id} className={cardClass}>
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

  // Early returns must be wrapped in a single parent element
  if (loading) {
    return (
      <div className="loading-indicator">Loading Fees Analytics...</div>
    );
  }
  
  if (error) {
    return (
      <div className="error-message">{error}</div>
    );
  }
  
  if (!data || !data.kpis) {
    return (
      <div className="error-message">No fees data available.</div>
    );
  }

  const { kpis } = data;

  return (
    <div className="fees-dashboard-container">
      <div className="header-container">
        <h2>Fees Analytics</h2>
        
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
            <label>Payment Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all"> Status</option>
              {filterOptions.payment_statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Payment Mode</label>
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
            >
              <option value="all">All Modes</option>
              {filterOptions.payment_modes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <br></br>
          {/* Date Range Filter */}
          <div className="filter-group date-range-group">
            <label>Date Range</label>
            <div className="date-range-inputs">
              <input
                type="date"
                value={tempStartDate}
                onChange={(e) => handleDateChange('start', e.target.value)}
                placeholder="Start Date"
              />
              <span className="date-range-separator">to</span>
              <input
                type="date"
                value={tempEndDate}
                onChange={(e) => handleDateChange('end', e.target.value)}
                placeholder="End Date"
              />
              {(tempStartDate || tempEndDate) && (
                <button 
                  className="clear-date-btn"
                  onClick={clearDateFilters}
                  title="Clear date filters"
                >
                  ×
                </button>
              )}
            </div>
            
          </div>
        </div>
      )}

      <div className="kpi-grid">
        <div className="kpi-card amount" onClick={() => handleKpiClick('total_amount')}>
          <div className="kpi-value">
            ₹{formatAmount(kpis.total_amount)}
          </div>
          <div className="kpi-label">Total Amount</div>
        </div>
        <div className="kpi-card paid" onClick={() => handleKpiClick('total_paid')}>
          <div className="kpi-value">
            ₹{formatAmount(kpis.total_paid)}
          </div>
          <div className="kpi-label">Total Paid</div>
        </div>
        <div className="kpi-card unpaid" onClick={() => handleKpiClick('total_unpaid')}>
          <div className="kpi-value">
            ₹{formatAmount(kpis.total_unpaid)}
          </div>
          <div className="kpi-label">Total Unpaid</div>
        </div>
        <div className="kpi-card total-trans" onClick={() => handleKpiClick('total_transactions')}>
          <div className="kpi-value">
            {kpis.total_transactions ? kpis.total_transactions.toLocaleString("en-IN") : '0'}
          </div>
          <div className="kpi-label">Total Transactions</div>
        </div>
        <div className="kpi-card successful-trans" onClick={() => handleKpiClick('successful_transactions')}>
          <div className="kpi-value">
            {kpis.successful_transactions ? kpis.successful_transactions.toLocaleString("en-IN") : '0'}
          </div>
          <div className="kpi-label">Successful Transactions</div>
        </div>
        <div className="kpi-card pending-trans" onClick={() => handleKpiClick('pending_transactions')}>
          <div className="kpi-value">
            {kpis.pending_transactions ? kpis.pending_transactions.toLocaleString("en-IN") : '0'}
          </div>
          <div className="kpi-label">Pending Transactions</div>
        </div>
        {kpis.refunded_transactions > 0 && (
          <div className="kpi-card refunded-trans" onClick={() => handleKpiClick('refunded_transactions')}>
            <div className="kpi-value">
              {kpis.refunded_transactions ? kpis.refunded_transactions.toLocaleString("en-IN") : '0'}
            </div>
            <div className="kpi-label">Refunded Transactions</div>
          </div>
        )}
        {kpis.total_refunded > 0 && (
          <div className="kpi-card total-refunded" onClick={() => handleKpiClick('total_refunded')}>
            <div className="kpi-value">
              ₹{formatAmount(kpis.total_refunded)}
            </div>
            <div className="kpi-label">Total Refunded</div>
          </div>
        )}
      </div>

      <div className="charts-grid">{filteredCharts.map(renderChart)}</div>

      {isPopupOpen && (
        <div className="modal-overlay" onClick={() => closeAllModals()}>
          <div
            className="modal-content large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{popupData.title}</h3>
              <div className="modal-header-controls">
                {modalHistory.length > 1 && (
                  <button
                    onClick={goBackToPreviousModal}
                    className="back-button"
                    title="Go back to previous view"
                  >
                    ← Back
                  </button>
                )}
                <button
                  onClick={closeAllModals}
                  className="close-button"
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="modal-body">
              <div className="modal-controls">
                <button
                  onClick={() => exportData(filteredPopupTransactions)}
                  className="view-full-list-btn"
                >
                  Export Excel
                </button>
                <input
                  type="text"
                  placeholder="Search Transactions..."
                  className="modal-search"
                  value={popupSearchTerm}
                  onChange={(e) => setPopupSearchTerm(e.target.value)}
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
  {filteredPopupTransactions.map((t) => (
    <tr
      key={t.fees_trans_id}
      onClick={() => handleViewTransactionDetails(t)}
    >
      <td>{t.registration_code || 'N/A'}</td>
      <td>{t.student_name || 'N/A'}</td>
      <td>{t.fees_paid_date || 'N/A'}</td>
      <td>{formatAmount(t.amount_paid || t.amt_paid)}</td>
      <td>{t.payment_status || 'N/A'}</td>
      <td>{t.payment_mode || 'N/A'}</td>
      <td>{t.installment_no || 'N/A'}</td>
    </tr>
  ))}
</tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {isDetailViewOpen && selectedTransaction && (
        <div
          className="modal-overlay"
          onClick={() => closeAllModals()}
        >
          <div
            className="modal-content large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Transaction Details: {selectedTransaction.fees_trans_id}</h3>
              <div className="modal-header-controls">
                {modalHistory.length > 1 && (
                  <button
                    onClick={goBackToPreviousModal}
                    className="back-button"
                    title="Go back to previous view"
                  >
                    ← Back
                  </button>
                )}
                <button
                  onClick={closeAllModals}
                  className="close-button"
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="modal-body student-detail-view">
              <div className="detail-sections">
                <div className="detail-section">
                  <h4>Basic Information</h4>
                  <div className="detail-grid">
                    <p><strong>Registration Code:</strong> {selectedTransaction.registration_code || 'N/A'}</p>
                    <p><strong>Student Name:</strong> {selectedTransaction.student_name || 'N/A'}</p>
                    <p><strong>Course:</strong> {selectedTransaction.course_name || 'N/A'}</p>
                    <p><strong>Institution:</strong> {selectedTransaction.institution_code || 'N/A'}</p>
                    <p><strong>Division:</strong> {selectedTransaction.division_name || 'N/A'}</p>
                  </div>
                </div>
                
                <div className="detail-section">
                  <h4>Payment Information</h4>
                  <div className="detail-grid">
                    <p><strong>Transaction ID:</strong> {selectedTransaction.fees_trans_id || 'N/A'}</p>
                    <p><strong>Payment Status:</strong> {selectedTransaction.payment_status || 'N/A'}</p>
                    <p><strong>Payment Mode:</strong> {selectedTransaction.payment_mode || 'N/A'}</p>
                    <p><strong>Payment Option:</strong> {selectedTransaction.payment_option || 'N/A'}</p>
                    <p><strong>Fees Category:</strong> {selectedTransaction.fees_category || 'N/A'}</p>
                    <p><strong>Installment No:</strong> {selectedTransaction.installment_no || 'N/A'}</p>
                    <p><strong>Total Amount:</strong> ₹{formatAmount(selectedTransaction.total_amt)}</p>
                    <p><strong>Amount Paid:</strong> ₹{formatAmount(selectedTransaction.amount_paid)}</p>
                    <p><strong>Remaining Amount:</strong> ₹{formatAmount((selectedTransaction.total_amt || 0) - (selectedTransaction.amount_paid || 0))}</p>
                    <p><strong>Fees Paid Date:</strong> {selectedTransaction.fees_paid_date || 'N/A'}</p>
                    <p><strong>Due Date:</strong> {selectedTransaction.due_date || 'N/A'}</p>
                    <p><strong>Late Payment Charges:</strong> ₹{formatAmount(selectedTransaction.late_payment_charges)}</p>
                  </div>
                </div>
                
                <div className="detail-section">
                  <h4>Payment Reference Details</h4>
                  <div className="detail-grid">
                    <p><strong>Qfix Reference No:</strong> {selectedTransaction.qfix_ref_no || 'N/A'}</p>
                    <p><strong>Payment Details:</strong> {selectedTransaction.payment_details || 'N/A'}</p>
                    <p><strong>Payment Reference Details:</strong> {selectedTransaction.payment_reference_details || 'N/A'}</p>
                    <p><strong>Settlement Date:</strong> {selectedTransaction.settlement_date || 'N/A'}</p>
                    <p><strong>Bank Reference No:</strong> {selectedTransaction.bank_reference_no || 'N/A'}</p>
                  </div>
                </div>
                
                <div className="detail-section">
                  <h4>Fee Components</h4>
                  <div className="fee-components-grid">
                    {selectedTransaction.fee_components && Object.entries(selectedTransaction.fee_components).map(([component, amount]) => (
                      amount > 0 && (
                        <div key={component} className="fee-component-item">
                          <span className="component-name">{component.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span>
                          <span className="component-amount">₹{formatAmount(amount)}</span>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isRevenueDetailOpen && revenueDetailData && (
        <div className="modal-overlay" onClick={() => closeAllModals()}>
          <div
            className="modal-content x-large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{revenueDetailData.title} - Revenue Details</h3>
              <div className="modal-header-controls">
                {modalHistory.length > 1 && (
                  <button
                    onClick={goBackToPreviousModal}
                    className="back-button"
                    title="Go back to previous view"
                  >
                    ← Back
                  </button>
                )}
                <button
                  onClick={closeAllModals}
                  className="close-button"
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="modal-body">
              <div className="revenue-summary">
                <div className="summary-item">
                  <h4>Total Transactions</h4>
                  <p>{revenueDetailData.summary.total_transactions}</p>
                </div>
                <div className="summary-item">
                  <h4>Total Amount Collected</h4>
                  <p>₹{formatAmount(revenueDetailData.summary.total_collected)}</p>
                </div>
                <div className="summary-item">
                  <h4>Total Amount to Be Collected</h4>
                  <p>₹{formatAmount(revenueDetailData.summary.total_to_collect)}</p>
                </div>
                <div className="summary-item">
                  <h4>Average Amount</h4>
                  <p>₹{formatAmount(revenueDetailData.summary.average_amount)}</p>
                </div>
              </div>
              
              <div className="modal-controls">
                <button
                  onClick={() => exportData(revenueDetailData.transactions)}
                  className="view-full-list-btn"
                >
                  Export Excel
                </button>
              </div>
              
              <div className="transaction-table-container">
                <table className="transaction-table">
                  <thead>
                    <tr>
                      <th>Transaction ID</th>
                      <th>Date</th>
                      <th>Institute</th>
                      <th>Student</th>
                      <th>Course</th>
                      <th>Installment</th>
                      <th>Amount Paid</th>
                      <th>Total Amount</th>
                      <th>Status</th>
                      <th>Payment Mode</th>
                      <th>Qfix Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueDetailData.transactions.map((t) => (
                      <tr key={t.fees_trans_id}>
                        <td>{t.fees_trans_id || 'N/A'}</td>
                        <td>{t.fees_paid_date || 'N/A'}</td>
                        <td>{t.institution_code || 'N/A'}</td>
                        <td>{t.student_name || 'N/A'}</td>
                        <td>{t.course_name || 'N/A'}</td>
                        <td>{t.installment_no || 'N/A'}</td>
                        <td>₹{formatAmount(t.amount_paid)}</td>
                        <td>₹{formatAmount(t.total_amt)}</td>
                        <td>{t.payment_status || 'N/A'}</td>
                        <td>{t.payment_mode || 'N/A'}</td>
                         <td>{t.qfix_ref_no || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Fees;