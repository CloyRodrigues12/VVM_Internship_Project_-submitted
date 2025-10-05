<?php
require_once 'functions.php';

// Initialize all variables with default values
$institutions = getInstitutions();
$batches = getBatches();

// Get ALL filter values
$institutionId = $_GET['institution'] ?? null;
$batch = $_GET['batch'] ?? null;
$genderFilter = $_GET['gender'] ?? null;
$studentCategoryFilter = $_GET['student_category'] ?? null;

// Get data based on ALL filters
$totalStudents = getTotalStudents($institutionId, $batch, $genderFilter, null, null, $studentCategoryFilter);
$pwdStudents = getPWDStudents($institutionId, $batch, $genderFilter, null, null, $studentCategoryFilter);
$genderData = getGenderDistribution($institutionId, $batch, $genderFilter, null, null, $studentCategoryFilter);
$religionData = getReligionDistribution($institutionId, $batch, $genderFilter, null, null, $studentCategoryFilter);
$bloodData = getBloodGroupDistribution($institutionId, $batch, $genderFilter, null, null, $studentCategoryFilter);
$studentCategoryData = getStudentCategoryDistribution($institutionId, $batch, $genderFilter, null, null, $studentCategoryFilter);
$fathersOccupationData = getFathersOccupation($institutionId, $batch, $genderFilter, null, null, $studentCategoryFilter);
$mothersOccupationData = getMothersOccupation($institutionId, $batch, $genderFilter, null, null, $studentCategoryFilter);
$streamData = getStreamDistribution($institutionId, $batch, $genderFilter, null, null, $studentCategoryFilter);
$pincodeData = getPincodeDistribution($institutionId, $batch, $genderFilter, null, null, $studentCategoryFilter);
$stateData = getStateDistribution($institutionId, $batch, $genderFilter, null, null, $studentCategoryFilter);
$ageData = getAgeDistribution($institutionId, $batch, $genderFilter, null, null, $studentCategoryFilter);
$previousSchoolsData = getPreviousSchools($institutionId, $batch, $genderFilter, null, null, $studentCategoryFilter);
$classData = getClassDistribution($institutionId, $batch, $genderFilter, null, null, $studentCategoryFilter);
$classSectionStreamData = getClassSectionStreamDistribution($institutionId, $batch, $genderFilter, null, null, $studentCategoryFilter);

function prepareChartData($data, $labelKey = 'label') {
    $result = [
        'labels' => [],
        'counts' => [],
        'student_ids' => []
    ];
    
    if (!empty($data)) {
        foreach ($data as $item) {
            $result['labels'][] = $item[$labelKey] ?? $item['category'] ?? $item['group'] ?? $item['gender_group'] ?? '';
            $result['counts'][] = $item['count'] ?? 0;
            $result['student_ids'][] = $item['student_ids'] ?? '';
        }
    } else {
        // Return empty data structure if no data
        $result['labels'] = ['No Data'];
        $result['counts'] = [0];
        $result['student_ids'] = [''];
    }
    
    return $result;
}

// Prepare all chart data
$genderChartData = prepareChartData($genderData, 'gender_group');
$religionChartData = prepareChartData($religionData, 'religion');
$bloodChartData = prepareChartData($bloodData, 'blood_group');
$studentCategoryChartData = prepareChartData($studentCategoryData, 'category');
$fathersOccupationChartData = prepareChartData($fathersOccupationData, 'fathers_occupation');
$mothersOccupationChartData = prepareChartData($mothersOccupationData, 'mothers_occupation');
$streamChartData = prepareChartData($streamData, 'stream');
$classChartData = prepareChartData($classData, 'class');
$classSectionStreamChartData = prepareChartData($classSectionStreamData, 'label');
$pincodeChartData = prepareChartData($pincodeData, 'pin_code');
$stateChartData = prepareChartData($stateData, 'state');
$ageChartData = prepareChartData($ageData, 'age_group');
$previousSchoolsChartData = prepareChartData($previousSchoolsData, 'previous_school');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VVM Student Analytics Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-pattern"></script>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <style>
        :root {
            --primary: #4361ee;
            --secondary: #3f37c9;
            --accent: #f72585;
            --light: #f8f9fa;
            --dark: #212529;
            --gray: #6c757d;
            --light-gray: #e9ecef;
            --success: #4cc9f0;
            --warning: #ffbe0b;
            --danger: #f15bb5;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Poppins', sans-serif;
        }
        
        body {
            background-color: #f5f7fb;
            color: var(--dark);
        }
        
.dashboard {
    display: flex;
    min-height: 100vh;
    margin-left: 250px; /* Add this to push content past the sidebar */
    width: calc(100% - 250px); /* Add this to adjust width */
}

.sidebar {
    width: 250px;
    background: linear-gradient(180deg, var(--primary), var(--secondary));
    color: white;
    padding: 20px 0;
    transition: all 0.3s;
    box-shadow: 2px 0 10px rgba(0,0,0,0.1);
    position: fixed;
    height: 100vh;
    z-index: 999;
    overflow-y: auto;
    top: 0;
    left: 0;
}
        
        .logo {
            display: flex;
            align-items: center;
            padding: 0 20px 30px;
            font-size: 1.2rem;
            font-weight: 600;
        }
        
        .logo span:first-child {
            margin-right: 10px;
            font-size: 1.5rem;
        }
        
        .nav-menu {
            list-style: none;
        }
        
        .nav-item {
            margin-bottom: 5px;
        }
        
        .nav-link {
            display: flex;
            align-items: center;
            padding: 12px 20px;
            color: rgba(255,255,255,0.8);
            text-decoration: none;
            transition: all 0.3s;
            border-left: 3px solid transparent;
        }
        
        .nav-link:hover, .nav-link.active {
            background-color: rgba(255,255,255,0.1);
            color: white;
            border-left: 3px solid var(--accent);
        }
        
        .nav-link span:first-child {
            margin-right: 10px;
            width: 20px;
            text-align: center;
        }
        
        .main-content {
            flex: 1;
            padding: 20px;
            overflow-x: hidden;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--light-gray);
        }
        
        .page-title h1 {
            color: var(--dark);
            font-weight: 600;
        }
        
        .user-profile {
            display: flex;
            align-items: center;
        }
        
        .user-avatar {
            width: 40px;
            height: 40px;
            background-color: var(--primary);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 10px;
            font-weight: 500;
        }
        
        .kpi-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .kpi-card {
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            transition: transform 0.3s, box-shadow 0.3s;
            cursor: pointer;
            border-top: 4px solid var(--primary);
        }
        
        .kpi-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 15px rgba(0,0,0,0.1);
        }
        
        .kpi-card.total-students {
            border-top-color: var(--primary);
        }
        
        .kpi-card.pwd-students {
            border-top-color: var(--accent);
        }
        
        .kpi-card.institutions {
            border-top-color: var(--success);
        }
        
        .kpi-card.batches {
            border-top-color: var(--warning);
        }
        
        .kpi-value {
            font-size: 2rem;
            font-weight: 600;
            margin-bottom: 5px;
            color: var(--dark);
        }
        
        .kpi-label {
            font-size: 0.9rem;
            color: var(--gray);
        }
        
        .filters {
            background: white;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            align-items: flex-end;
        }
        
        .filter-group {
            flex: 1;
            min-width: 200px;
        }
        
        .filter-group label {
            display: block;
            margin-bottom: 8px;
            font-size: 0.9rem;
            color: var(--gray);
            font-weight: 500;
        }
        
        .filter-group select, .filter-group input {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--light-gray);
            border-radius: 6px;
            background-color: white;
            font-size: 0.9rem;
            transition: all 0.3s;
        }
        
        .filter-group select:focus, .filter-group input:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(67, 97, 238, 0.2);
        }
        
        .apply-btn {
            background-color: var(--primary);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            transition: background-color 0.3s;
        }
        
        .apply-btn:hover {
            background-color: var(--secondary);
        }
        
        .advanced-filters-btn {
            background-color: white;
            color: var(--primary);
            border: 1px solid var(--primary);
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.3s;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .advanced-filters-btn:hover {
            background-color: var(--light);
        }
        
        .advanced-filters-container {
            display: none;
            background: white;
            border-radius: 10px;
            padding: 20px;
            margin-top: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }
        
        .advanced-filters-container.show {
            display: block;
            animation: fadeIn 0.3s ease-in-out;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .charts-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .chart-card {
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            overflow: hidden;
            transition: transform 0.3s, box-shadow 0.3s;
        }
        
        .chart-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 15px rgba(0,0,0,0.1);
        }
        
        .chart-header {
            padding: 15px 20px;
            border-bottom: 1px solid var(--light-gray);
        }
        
        .chart-title {
            font-size: 1rem;
            font-weight: 600;
            color: var(--dark);
        }
        
        .chart-container {
            padding: 15px;
            height: 300px;
            position: relative;
        }
        
        .chart-card:has(#classSectionStreamChart) {
            grid-column: 1 / -1;
        }
        
        .chart-card:has(#classSectionStreamChart) .chart-container {
            height: 400px;
        }
        
        .footer {
            text-align: center;
            padding: 20px;
            color: var(--gray);
            font-size: 0.9rem;
            border-top: 1px solid var(--light-gray);
        }
        
        /* Responsive adjustments */
        @media (max-width: 768px) {
            .dashboard {
                flex-direction: column;
            }
            
            .sidebar {
                width: 100%;
                height: auto;
            }
            
            .charts-container {
                grid-template-columns: 1fr;
            }
            
            .filter-group {
                min-width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="sidebar">
            <div class="logo">
                <span>📊</span>
                <span>VVM Analytics</span>
            </div>
            <ul class="nav-menu">
                <li class="nav-item">
                    <a href="index.php" class="nav-link active">
                        <span><i class="fas fa-home"></i></span>
                        <span>Students</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="fees_index.php" class="nav-link">
                        <span><i class="fas fa-users"></i></span>
                        <span>Fees</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="institution.php" class="nav-link">
                        <span><i class="fas fa-school"></i></span>
                        <span>Institutions</span>
                    </a>
                </li>
                
                
            </ul>
        </div>
        <div class="main-content">
            <div class="header">
                <div class="page-title">
                    <h1>Student Analytics Dashboard</h1>
                    <p>Comprehensive insights into student demographics</p>
                </div>
                <div class="user-profile">
                    <div class="user-avatar">AD</div>
                    <span>Admin</span>
                </div>
            </div>

            <!-- KPI Cards -->
            <div class="kpi-cards">
                <div class="kpi-card total-students" onclick="showAllStudents()">
                    <div class="kpi-value"><?= number_format($totalStudents) ?></div>
                    <div class="kpi-label">Total Students</div>
                </div>
                
                <div class="kpi-card institutions">
                    <div class="kpi-value"><?= count($institutions) ?></div>
                    <div class="kpi-label">Institutions</div>
                </div>
                <div class="kpi-card batches">
                    <div class="kpi-value"><?= count($batches) ?></div>
                    <div class="kpi-label">Batches</div>
                </div>
            </div>

            <form method="GET" class="filters" id="filterForm">
                <input type="hidden" name="advanced" id="advancedFilterFlag" value="<?= (isset($_GET['advanced']) && $_GET['advanced'] == '1') ? '1' : '0' ?>">
                
                <div class="filter-group">
                    <label for="institution">Institution</label>
                    <select id="institution" name="institution">
                        <option value="">All Institutions</option>
                        <?php foreach ($institutions as $institution): ?>
                            <option value="<?= $institution['institution_id'] ?>" <?= $institutionId == $institution['institution_id'] ? 'selected' : '' ?>>
                                <?= htmlspecialchars($institution['institution_name']) ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div class="filter-group">
                    <label for="batch">Batch</label>
                    <select id="batch" name="batch">
                        <option value="">All Batches</option>
                        <?php foreach ($batches as $batchItem): ?>
                            <option value="<?= $batchItem['batch_year'] ?>" <?= $batch == $batchItem['batch_year'] ? 'selected' : '' ?>>
                                <?= htmlspecialchars($batchItem['batch_year']) ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>
                
                <div class="filter-group">
                    <button type="submit" class="apply-btn">Apply Filters</button>
                </div>

                <div class="filter-group">
                    <button type="button" class="advanced-filters-btn" onclick="toggleAdvancedFilters()">
                        <i class="fas fa-sliders-h"></i> Advanced Filters
                    </button>
                </div>

                <div id="advancedFilters" class="advanced-filters-container" style="<?= (isset($_GET['advanced']) && $_GET['advanced'] == '1') ? 'display: block;' : '' ?>">
                    <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 15px;">
                        <div class="filter-group">
                            <label for="gender">Gender</label>
                            <select id="gender" name="gender">
                                <option value="">All Genders</option>
                                <option value="Male" <?= (isset($_GET['gender']) && $_GET['gender'] == 'Male') ? 'selected' : '' ?>>Male</option>
                                <option value="Female" <?= (isset($_GET['gender']) && $_GET['gender'] == 'Female') ? 'selected' : '' ?>>Female</option>
                                <option value="Other" <?= (isset($_GET['gender']) && $_GET['gender'] == 'Other') ? 'selected' : '' ?>>Other</option>
                            </select>
                        </div>

                        <div class="filter-group">
                            <label for="student_category">Student Category</label>
                            <select id="student_category" name="student_category">
                                <option value="">All Categories</option>
                                <?php 
                                $categories = array_unique(array_column($studentCategoryData, 'category'));
                                foreach ($categories as $category): 
                                ?>
                                    <option value="<?= htmlspecialchars($category) ?>" <?= (isset($_GET['student_category']) && $_GET['student_category'] == $category) ? 'selected' : '' ?>>
                                        <?= htmlspecialchars($category) ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px;">
                        <button type="submit" class="apply-btn" onclick="setAdvancedFlag()">Apply Advanced Filters</button>
                        <button type="button" class="advanced-filters-btn" onclick="resetAdvancedFilters()">Reset</button>
                    </div>
                </div>
            </form>

            <div class="charts-container">
                <!-- Gender Distribution Chart - Doughnut -->
                <div class="chart-card">
                    <div class="chart-header">
                        <h3 class="chart-title">Gender Distribution</h3>
                    </div>
                    <div class="chart-container">
                        <canvas id="genderChart"></canvas>
                    </div>
                </div>

                <!-- Religion Distribution Chart - Pyramid -->
                <div class="chart-card">
                    <div class="chart-header">
                        <h3 class="chart-title">Religion Distribution</h3>
                    </div>
                    <div class="chart-container">
                        <canvas id="religionChart"></canvas>
                    </div>
                </div>

                <!-- Blood Group Distribution Chart - Circular Bar -->
                <div class="chart-card">
                    <div class="chart-header">
                        <h3 class="chart-title">Blood Group Distribution</h3>
                    </div>
                    <div class="chart-container">
                        <canvas id="bloodChart"></canvas>
                    </div>
                </div>

                <!-- Student Category Chart - Doughnut with Cutout -->
                <div class="chart-card">
                    <div class="chart-header">
                        <h3 class="chart-title">Student Category</h3>
                    </div>
                    <div class="chart-container">
                        <canvas id="studentCategoryChart"></canvas>
                    </div>
                </div>

                <!-- Father's Occupation Chart - Line Chart -->
                <div class="chart-card">
                    <div class="chart-header">
                        <h3 class="chart-title">Father's Occupation</h3>
                    </div>
                    <div class="chart-container">
                        <canvas id="fathersOccupationChart"></canvas>
                    </div>
                </div>

                <!-- Mother's Occupation Chart - Line Chart -->
                <div class="chart-card">
                    <div class="chart-header">
                        <h3 class="chart-title">Mother's Occupation</h3>
                    </div>
                    <div class="chart-container">
                        <canvas id="mothersOccupationChart"></canvas>
                    </div>
                </div>

                <!-- Stream-wise Student Count - Stacked Bar -->
                <div class="chart-card">
                    <div class="chart-header">
                        <h3 class="chart-title">Stream-wise Student Count</h3>
                    </div>
                    <div class="chart-container">
                        <canvas id="streamChart"></canvas>
                    </div>
                </div>

                <!-- Class-wise Student Distribution -->
                <div class="chart-card">
                    <div class="chart-header">
                        <h3 class="chart-title">Class-wise Student Distribution</h3>
                    </div>
                    <div class="chart-container">
                        <canvas id="classChart"></canvas>
                    </div>
                </div>

                <!-- Class-Section-Stream Distribution Chart -->
                <div class="chart-card">
                    <div class="chart-header">
                        <h3 class="chart-title">Class-Section-Stream Distribution</h3>
                    </div>
                    <div class="chart-container">
                        <canvas id="classSectionStreamChart"></canvas>
                    </div>
                </div>

                <!-- Pincode Distribution - Bar with Slash Pattern -->
                <div class="chart-card">
                    <div class="chart-header">
                        <h3 class="chart-title">Pincode Distribution</h3>
                    </div>
                    <div class="chart-container">
                        <canvas id="pincodeChart"></canvas>
                    </div>
                </div>

                <!-- State-wise Student Count - Gradient Bar -->
                <div class="chart-card">
                    <div class="chart-header">
                        <h3 class="chart-title">State-wise Student Count</h3>
                    </div>
                    <div class="chart-container">
                        <canvas id="stateChart"></canvas>
                    </div>
                </div>

                <!-- Age Group Distribution - Line Graph -->
                <div class="chart-card">
                    <div class="chart-header">
                        <h3 class="chart-title">Age Group Distribution</h3>
                    </div>
                    <div class="chart-container">
                        <canvas id="ageChart"></canvas>
                    </div>
                </div>

                <!-- Previous School/College Attended - Horizontal Histogram -->
                <div class="chart-card">
                    <div class="chart-header">
                        <h3 class="chart-title">Previous School/College Attended</h3>
                    </div>
                    <div class="chart-container">
                        <canvas id="previousSchoolsChart"></canvas>
                    </div>
                </div>
            </div>

            <div class="footer">
                <p>© <?= date('Y') ?> VVM Analytics Dashboard. All rights reserved.</p>
            </div>
        </div>
    </div>

    <script>
        // Toggle advanced filters
        function toggleAdvancedFilters() {
            const container = document.getElementById('advancedFilters');
            container.classList.toggle('show');
        }

        // Set advanced filter flag before submission
        function setAdvancedFlag() {
            document.getElementById('advancedFilterFlag').value = '1';
        }

        // Function to reset advanced filters
        function resetAdvancedFilters() {
            document.getElementById('gender').value = '';
            document.getElementById('student_category').value = '';
            document.getElementById('advancedFilterFlag').value = '1';
            document.getElementById('filterForm').submit();
        }

        // Helper function to map chart IDs to filter types
        function getFilterTypeFromChartId(chartId) {
            const mapping = {
                'genderChart': 'gender',
                'religionChart': 'religion',
                'bloodChart': 'blood_group',
                'studentCategoryChart': 'student_category',
                'fathersOccupationChart': 'fathers_occupation',
                'mothersOccupationChart': 'mothers_occupation',
                'streamChart': 'stream',
                'pincodeChart': 'pin_code',
                'stateChart': 'state',
                'ageChart': 'age_group',
                'previousSchoolsChart': 'previous_school',
                'classChart': 'class',
                'classSectionStreamChart': 'class_section_stream'
            };
            return mapping[chartId] || '';
        }

        // Centralized function to handle all chart click events
        function handleChartClick(event, elements, chart) {
            if (elements.length > 0) {
                const index = elements[0].index;
                const label = chart.data.labels[index];
                const ids = chart.data.datasets[0].studentIds[index] ?
                           chart.data.datasets[0].studentIds[index].split(',') : [];
                
                if (ids.length > 0) {
                    const chartId = chart.canvas.id;
                    let filterType = getFilterTypeFromChartId(chartId);
                    let filterValue = label;
                    
                    // Special handling for class-section-stream chart
                    if (chartId === 'classSectionStreamChart') {
                        // Split the combined label back into components
                        const parts = label.split(' ');
                        const classPart = parts[0];
                        const section = parts.length > 1 ? parts[1] : '';
                        const stream = parts.length > 2 ? parts.slice(2).join(' ') : '';
                        
                        let url = 'student_list.php?filterType=class_section_stream';
                        url += `&class=${encodeURIComponent(classPart)}`;
                        if (section) url += `&section=${encodeURIComponent(section)}`;
                        if (stream) url += `&stream=${encodeURIComponent(stream)}`;
                        
                        const institutionId = document.getElementById('institution').value;
                        const batch = document.getElementById('batch').value;
                        const gender = document.getElementById('gender').value;
                        const studentCategory = document.getElementById('student_category').value;
                        
                        if (institutionId) url += `&institution=${institutionId}`;
                        if (batch) url += `&batch=${encodeURIComponent(batch)}`;
                        if (gender) url += `&gender=${encodeURIComponent(gender)}`;
                        if (studentCategory) url += `&student_category=${encodeURIComponent(studentCategory)}`;
                        
                        window.open(url, '_blank');
                        return;
                    }
                    
                    // For class chart
                    if (chartId === 'classChart') {
                        filterType = 'class';
                        filterValue = label;
                    }
                    
                    let url = `student_list.php?filterType=${encodeURIComponent(filterType)}`;
                    if (filterValue) {
                        url += `&filterValue=${encodeURIComponent(filterValue)}`;
                    }
                    
                    const institutionId = document.getElementById('institution').value;
                    const batch = document.getElementById('batch').value;
                    const gender = document.getElementById('gender').value;
                    const studentCategory = document.getElementById('student_category').value;
                    
                    if (institutionId) url += `&institution=${institutionId}`;
                    if (batch) url += `&batch=${encodeURIComponent(batch)}`;
                    if (gender) url += `&gender=${encodeURIComponent(gender)}`;
                    if (studentCategory) url += `&student_category=${encodeURIComponent(studentCategory)}`;
                    
                    window.open(url, '_blank');
                }
            }
        }

        // Function to show all students
        function showAllStudents() {
            const institutionId = document.getElementById('institution').value;
            const batch = document.getElementById('batch').value;
            const gender = document.getElementById('gender').value;
            const studentCategory = document.getElementById('student_category').value;
            
            let url = 'student_list.php?filterType=all';
            
            if (institutionId) url += `&institution=${institutionId}`;
            if (batch) url += `&batch=${encodeURIComponent(batch)}`;
            if (gender) url += `&gender=${encodeURIComponent(gender)}`;
            if (studentCategory) url += `&student_category=${encodeURIComponent(studentCategory)}`;
            
            window.open(url, '_blank');
        }

        // Function to create a doughnut chart
        function createDoughnutChart(canvasId, title, labels, data, studentIds) {
            const ctx = document.getElementById(canvasId).getContext('2d');
            const baseColor = 'rgba(67, 97, 238,';
            const backgroundColors = data.map((_, i) => {
                let intensity = 0.4 + (i / data.length) * 0.6;
                return `${baseColor} ${intensity})`;
            });

            const chart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: backgroundColors,
                        borderWidth: 1,
                        studentIds: studentIds
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right' },
                        title: {
                            display: true,
                            text: title,
                            font: { size: 14 }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = Math.round((value / total) * 100);
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    },
                    cutout: '65%',
                    onClick: function(event, elements) {
                        handleChartClick(event, elements, this);
                    }
                }
            });
        }

        // Function to create a pyramid chart (for religion)
        function createPyramidChart(canvasId, title, labels, data, studentIds) {
            const ctx = document.getElementById(canvasId).getContext('2d');
            
            const sortedIndices = [...Array(data.length).keys()].sort((a, b) => data[b] - data[a]);
            const sortedLabels = sortedIndices.map(i => labels[i]);
            const sortedData = sortedIndices.map(i => data[i]);
            const sortedStudentIds = sortedIndices.map(i => studentIds[i]);

            const baseHue = 220;
            const saturation = 70;
            const lightnessStart = 80;
            const lightnessEnd = 40;

            const backgroundColors = sortedData.map((_, i) => {
                const lightness = lightnessStart - (i / sortedData.length) * (lightnessStart - lightnessEnd);
                return `hsl(${baseHue}, ${saturation}%, ${lightness}%)`;
            });

            const chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: sortedLabels,
                    datasets: [{
                        label: 'Count',
                        data: sortedData,
                        backgroundColor: backgroundColors,
                        borderWidth: 1,
                        studentIds: sortedStudentIds
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        title: {
                            display: true,
                            text: title,
                            font: { size: 14 }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = Math.round((value / total) * 100);
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            ticks: { precision: 0 }
                        },
                        y: {
                            ticks: { autoSkip: false }
                        }
                    },
                    onClick: function(event, elements) {
                        handleChartClick(event, elements, this);
                    }
                }
            });
        }

        // Function to create a circular bar chart (for blood group)
        function createCircularBarChart(canvasId, title, labels, data, studentIds) {
            const ctx = document.getElementById(canvasId).getContext('2d');

            const baseHue = 0;
            const saturation = 70;
            const lightnessStart = 80;
            const lightnessEnd = 40;

            const backgroundColors = labels.map((_, i) => {
                const lightness = lightnessStart - (i / labels.length) * (lightnessStart - lightnessEnd);
                return `hsl(${baseHue}, ${saturation}%, ${lightness}%)`;
            });

            const chart = new Chart(ctx, {
                type: 'polarArea',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: backgroundColors,
                        borderWidth: 1,
                        studentIds: studentIds
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right' },
                        title: {
                            display: true,
                            text: title,
                            font: { size: 14 }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = Math.round((value / total) * 100);
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    },
                    scales: {
                        r: {
                            angleLines: { display: true },
                            suggestedMin: 0,
                            ticks: { display: false }
                        }
                    },
                    elements: {
                        arc: {
                            borderWidth: 0,
                            borderAlign: 'center'
                        }
                    },
                    onClick: function(event, elements) {
                        handleChartClick(event, elements, this);
                    }
                }
            });
        }

        // Function to create a line chart (for father's and mother's occupation)
        function createLineChart(canvasId, title, labels, data, studentIds) {
            const ctx = document.getElementById(canvasId).getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, 'rgba(67, 97, 238, 0.8)');
            gradient.addColorStop(1, 'rgba(67, 97, 238, 0.2)');
            
            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Count',
                        data: data,
                        backgroundColor: gradient,
                        borderColor: '#4361ee',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#4361ee',
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        studentIds: studentIds
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        title: {
                            display: true,
                            text: title,
                            font: { size: 14 }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0 }
                        }
                    },
                    onClick: function(event, elements) {
                        handleChartClick(event, elements, this);
                    }
                }
            });
        }

        // Function to create a stacked bar chart (for stream)
        function createStackedBarChart(canvasId, title, labels, data, studentIds) {
            const ctx = document.getElementById(canvasId).getContext('2d');

            const baseHue = 220;
            const saturation = 70;
            const lightnessStart = 75;
            const lightnessEnd = 40;

            const backgroundColors = labels.map((_, i) => {
                const lightness = lightnessStart - (i / labels.length) * (lightnessStart - lightnessEnd);
                return `hsl(${baseHue}, ${saturation}%, ${lightness}%)`;
            });

            const chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Count',
                        data: data,
                        backgroundColor: backgroundColors,
                        borderWidth: 1,
                        studentIds: studentIds
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        title: {
                            display: true,
                            text: title,
                            font: { size: 14 }
                        }
                    },
                    scales: {
                        x: { stacked: true },
                        y: {
                            stacked: true,
                            beginAtZero: true,
                            ticks: { precision: 0 }
                        }
                    },
                    onClick: function(event, elements) {
                        handleChartClick(event, elements, this);
                    }
                }
            });
        }

        // Function to create a class-wise distribution chart
        function createClassDistributionChart(canvasId, title, labels, data, studentIds) {
            const ctx = document.getElementById(canvasId).getContext('2d');
            
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, 'rgba(103, 58, 183, 0.8)');
            gradient.addColorStop(1, 'rgba(103, 58, 183, 0.2)');
            
            const chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Students',
                        data: data,
                        backgroundColor: gradient,
                        borderColor: '#673ab7',
                        borderWidth: 1,
                        borderRadius: 4,
                        studentIds: studentIds
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        title: {
                            display: true,
                            text: title,
                            font: { size: 14 }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    return `${label}: ${value} students`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0 }
                        }
                    },
                    onClick: function(event, elements) {
                        handleChartClick(event, elements, this);
                    }
                }
            });
        }

        // Function to create Class-Section-Stream distribution chart
        function createClassSectionStreamChart(canvasId, title, labels, data, studentIds) {
            const ctx = document.getElementById(canvasId).getContext('2d');

            const baseHue = 0;
            const saturation = 70;
            const lightnessStart = 80;
            const lightnessEnd = 40;

            const backgroundColors = labels.map((_, i) => {
                const lightness = lightnessStart - (i / labels.length) * (lightnessStart - lightnessEnd);
                return `hsl(${baseHue}, ${saturation}%, ${lightness}%)`;
            });

            const chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Students',
                        data: data,
                        backgroundColor: backgroundColors,
                        borderWidth: 1,
                        borderRadius: 4,
                        studentIds: studentIds
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        title: {
                            display: true,
                            text: title,
                            font: { size: 14 }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `${context.parsed.y} students`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0 }
                        },
                        x: {
                            ticks: {
                                autoSkip: false,
                                maxRotation: 45,
                                minRotation: 45
                            }
                        }
                    },
                    onClick: function(event, elements) {
                        handleChartClick(event, elements, this);
                    }
                }
            });
        }

        // Function to create a bar chart with slash pattern (for pincode)
        function createSlashPatternBarChart(canvasId, title, labels, data, studentIds) {
            const ctx = document.getElementById(canvasId).getContext('2d');

            const baseHue = 220;
            const saturation = 70;
            const lightnessStart = 75;
            const lightnessEnd = 40;

            function createSlashPattern(color) {
                const patternCanvas = document.createElement('canvas');
                patternCanvas.width = 10;
                patternCanvas.height = 10;
                const pctx = patternCanvas.getContext('2d');

                pctx.strokeStyle = color;
                pctx.lineWidth = 2;
                pctx.beginPath();
                pctx.moveTo(0, 10);
                pctx.lineTo(10, 0);
                pctx.stroke();

                return ctx.createPattern(patternCanvas, 'repeat');
            }

            const backgroundPatterns = labels.map((_, i) => {
                const lightness = lightnessStart - (i / labels.length) * (lightnessStart - lightnessEnd);
                const color = `hsl(${baseHue}, ${saturation}%, ${lightness}%)`;
                return createSlashPattern(color);
            });

            const chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Count',
                        data: data,
                        backgroundColor: backgroundPatterns,
                        borderColor: '#4361ee',
                        borderWidth: 1,
                        studentIds: studentIds
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        title: {
                            display: true,
                            text: title,
                            font: { size: 14 }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0 }
                        }
                    },
                    onClick: function(event, elements) {
                        handleChartClick(event, elements, this);
                    }
                }
            });
        }

        // Function to create a gradient bar chart (for state)
        function createGradientBarChart(canvasId, title, labels, data, studentIds) {
            const ctx = document.getElementById(canvasId).getContext('2d');
            
            const backgroundColors = labels.map((label, index) => {
                const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                const hue = (index * 30) % 360;
                gradient.addColorStop(0, `hsla(${hue}, 80%, 60%, 0.8)`);
                gradient.addColorStop(1, `hsla(${hue}, 80%, 60%, 0.2)`);
                return gradient;
            });
            
            const chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Count',
                        data: data,
                        backgroundColor: backgroundColors,
                        borderWidth: 1,
                        studentIds: studentIds
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        title: {
                            display: true,
                            text: title,
                            font: { size: 14 }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0 }
                        }
                    },
                    onClick: function(event, elements) {
                        handleChartClick(event, elements, this);
                    }
                }
            });
        }

        // Function to create a horizontal histogram (for previous schools)
        function createHorizontalHistogram(canvasId, title, labels, data, studentIds) {
            const ctx = document.getElementById(canvasId).getContext('2d');

            const baseHue = 210;
            const saturation = 70;

            const colors = labels.map((label, i) => {
                const lightness = 80 - (i * (50 / labels.length)); 
                return `hsl(${baseHue}, ${saturation}%, ${lightness}%)`;
            });

            const chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Count',
                        data: data,
                        backgroundColor: colors,
                        borderWidth: 1,
                        studentIds: studentIds
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        title: {
                            display: true,
                            text: title,
                            font: { size: 14 }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            ticks: { precision: 0 }
                        }
                    },
                    onClick: function(event, elements) {
                        handleChartClick(event, elements, this);
                    }
                }
            });
        }

        // Initialize all charts when page loads
        document.addEventListener('DOMContentLoaded', function() {
            // Gender Distribution - Doughnut
            createDoughnutChart(
                'genderChart', 
                'Gender Distribution',
                <?= json_encode($genderChartData['labels']) ?>,
                <?= json_encode($genderChartData['counts']) ?>,
                <?= json_encode($genderChartData['student_ids']) ?>
            );

            // Religion Distribution - Pyramid
            createPyramidChart(
                'religionChart', 
                'Religion Distribution',
                <?= json_encode($religionChartData['labels']) ?>,
                <?= json_encode($religionChartData['counts']) ?>,
                <?= json_encode($religionChartData['student_ids']) ?>
            );

            // Blood Group Distribution - Circular Bar
            createCircularBarChart(
                'bloodChart', 
                'Blood Group Distribution',
                <?= json_encode($bloodChartData['labels']) ?>,
                <?= json_encode($bloodChartData['counts']) ?>,
                <?= json_encode($bloodChartData['student_ids']) ?>
            );

            // Student Category - Doughnut with cutout
            createDoughnutChart(
                'studentCategoryChart', 
                'Student Category',
                <?= json_encode($studentCategoryChartData['labels']) ?>,
                <?= json_encode($studentCategoryChartData['counts']) ?>,
                <?= json_encode($studentCategoryChartData['student_ids']) ?>
            );

            // Father's Occupation - Line Chart
            createLineChart(
                'fathersOccupationChart', 
                "Father's Occupation",
                <?= json_encode($fathersOccupationChartData['labels']) ?>,
                <?= json_encode($fathersOccupationChartData['counts']) ?>,
                <?= json_encode($fathersOccupationChartData['student_ids']) ?>
            );

            // Mother's Occupation - Line Chart
            createLineChart(
                'mothersOccupationChart', 
                "Mother's Occupation",
                <?= json_encode($mothersOccupationChartData['labels']) ?>,
                <?= json_encode($mothersOccupationChartData['counts']) ?>,
                <?= json_encode($mothersOccupationChartData['student_ids']) ?>
            );

            // Stream-wise Student Count - Stacked Bar
            createStackedBarChart(
                'streamChart', 
                'Stream-wise Student Count',
                <?= json_encode($streamChartData['labels']) ?>,
                <?= json_encode($streamChartData['counts']) ?>,
                <?= json_encode($streamChartData['student_ids']) ?>
            );

            // Class-wise Distribution - Bar Chart
            createClassDistributionChart(
                'classChart', 
                'Class-wise Student Distribution',
                <?= json_encode($classChartData['labels']) ?>,
                <?= json_encode($classChartData['counts']) ?>,
                <?= json_encode($classChartData['student_ids']) ?>
            );

            // Class-Section-Stream Distribution Chart
            createClassSectionStreamChart(
                'classSectionStreamChart', 
                'Class-Section-Stream Distribution',
                <?= json_encode($classSectionStreamChartData['labels']) ?>,
                <?= json_encode($classSectionStreamChartData['counts']) ?>,
                <?= json_encode($classSectionStreamChartData['student_ids']) ?>
            );

            // Pincode Distribution - Bar with Slash Pattern
            createSlashPatternBarChart(
                'pincodeChart', 
                'Pincode Distribution',
                <?= json_encode($pincodeChartData['labels']) ?>,
                <?= json_encode($pincodeChartData['counts']) ?>,
                <?= json_encode($pincodeChartData['student_ids']) ?>
            );

            // State-wise Student Count - Gradient Bar
            createGradientBarChart(
                'stateChart', 
                'State-wise Student Count',
                <?= json_encode($stateChartData['labels']) ?>,
                <?= json_encode($stateChartData['counts']) ?>,
                <?= json_encode($stateChartData['student_ids']) ?>
            );

            // Age Group Distribution - Line Chart
            createLineChart(
                'ageChart', 
                'Age Group Distribution',
                <?= json_encode($ageChartData['labels']) ?>,
                <?= json_encode($ageChartData['counts']) ?>,
                <?= json_encode($ageChartData['student_ids']) ?>
            );

            // Previous School/College Attended - Horizontal Histogram
            createHorizontalHistogram(
                'previousSchoolsChart', 
                'Previous School/College Attended',
                <?= json_encode($previousSchoolsChartData['labels']) ?>,
                <?= json_encode($previousSchoolsChartData['counts']) ?>,
                <?= json_encode($previousSchoolsChartData['student_ids']) ?>
            );
        });
    </script>
</body>
</html>