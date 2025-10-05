import mysql.connector
from datetime import date, datetime, timedelta
from decimal import Decimal


# --- Database Connection ---
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '',
    'database': 'new_VVM_Process_db'
}

def _convert_decimals_to_floats(data):
    """Recursively convert Decimal objects to floats in a dictionary or list."""
    if isinstance(data, dict):
        return {k: _convert_decimals_to_floats(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [_convert_decimals_to_floats(item) for item in data]
    elif isinstance(data, Decimal):
        return float(data)
    else:
        return data

def get_db_connection():
    """Establishes a connection to the MySQL database."""
    return mysql.connector.connect(**DB_CONFIG)

def _build_fees_where_clause(filters):
    """Builds the WHERE clause for fees-related queries."""
    where_clauses = []
    params = []
    
    if filters.get('institution_code') and filters['institution_code'] != 'all':
        where_clauses.append("ft.institution_code = %s")
        params.append(filters['institution_code'])
    
    if filters.get('payment_status') and filters['payment_status'] != 'all':
        # Handle multiple payment statuses (comma-separated)
        if ',' in filters['payment_status']:
            statuses = filters['payment_status'].split(',')
            placeholders = ', '.join(['%s'] * len(statuses))
            where_clauses.append(f"ft.payment_status IN ({placeholders})")
            params.extend(statuses)
        else:
            where_clauses.append("ft.payment_status = %s")
            params.append(filters['payment_status'])

    if filters.get('payment_mode') and filters['payment_mode'] != 'all':
        where_clauses.append("ft.payment_mode = %s")
        params.append(filters['payment_mode'])
        
    # Add date range filter
    if filters.get('start_date'):
        where_clauses.append("ft.fees_paid_date >= %s")
        params.append(filters['start_date'])
    
    if filters.get('end_date'):
        where_clauses.append("ft.fees_paid_date <= %s")
        params.append(filters['end_date'])
        
    # Special handling for due date status
    if filters.get('filterType') == 'due_date_status' and filters.get('filterValue') == 'OVERDUE':
        where_clauses.append("ft.due_date < CURDATE()")
        where_clauses.append("ft.payment_status IN ('UNPAID', 'PARTIAL_PAID')")
        
    where_clause_str = " AND ".join(where_clauses) if where_clauses else "1=1"
    return where_clause_str, params

def get_daily_trend_data(cursor, where_clause, params, filters):
    """Get daily trend data for the date range specified in filters, showing all days including those with no transactions"""
    
    # Extract date range from filters
    start_date_str = filters.get('start_date')
    end_date_str = filters.get('end_date')
    
    # If no date range is specified, default to current month
    if not start_date_str and not end_date_str:
        # Get current month and year
        today = date.today()
        current_month = today.month
        current_year = today.year
        
        # Get the number of days in the current month
        if current_month == 12:
            next_month = 1
            next_year = current_year + 1
        else:
            next_month = current_month + 1
            next_year = current_year
        
        # First day of current month
        start_date = date(current_year, current_month, 1)
        # First day of next month (to get the last day of current month)
        first_day_next_month = date(next_year, next_month, 1)
        # Last day of current month
        end_date = first_day_next_month - timedelta(days=1)
    else:
        # Use the provided date range
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date() if start_date_str else date.today()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date() if end_date_str else date.today()
    
    # Ensure end_date is not in the future
    today = date.today()
    if end_date > today:
        end_date = today
    
    # Generate all days in the date range
    days_in_range = []
    current_day = start_date
    while current_day <= end_date:
        days_in_range.append(current_day.strftime('%Y-%m-%d'))
        current_day += timedelta(days=1)
    
    # If no valid days, return empty
    if not days_in_range:
        return []
    
    # Get data for the date range
    # We need to modify the where clause to remove any date filters since we're handling them separately
    # Create a copy of the original where clause without date filters
    where_clause_parts = where_clause.split(" AND ")
    filtered_where_parts = []
    date_filter_params = []
    
    for part in where_clause_parts:
        if "ft.fees_paid_date" not in part:
            filtered_where_parts.append(part)
        else:
            # Extract the parameter if it's a date filter
            if "ft.fees_paid_date >= %s" in part:
                date_filter_params.append(start_date_str)
            elif "ft.fees_paid_date <= %s" in part:
                date_filter_params.append(end_date_str)
    
    # Rebuild the where clause without date filters
    clean_where_clause = " AND ".join(filtered_where_parts) if filtered_where_parts else "1=1"
    
    # Add our specific date range filter
    clean_where_clause += " AND ft.fees_paid_date >= %s AND ft.fees_paid_date <= %s"
    
    # Update parameters - remove any date filter params and add our new ones
    clean_params = [p for p in params if p not in date_filter_params]
    clean_params.extend([start_date, end_date])
    
    daily_trend_query = f"""
        SELECT DATE(ft.fees_paid_date) as label, 
               COUNT(ft.fees_trans_id) as count,
               SUM(ft.amount_paid) as amount
        FROM student_fee_transactions ft
        WHERE {clean_where_clause} AND ft.fees_paid_date IS NOT NULL 
        GROUP BY DATE(ft.fees_paid_date)
        ORDER BY label ASC
    """
    
    cursor.execute(daily_trend_query, clean_params)
    daily_data = {row['label'].strftime('%Y-%m-%d'): row for row in cursor.fetchall()}
    
    # Create result with all days in the range, filling zeros for missing days
    result = []
    for day in days_in_range:
        if day in daily_data:
            result.append(daily_data[day])
        else:
            result.append({
                'label': day,
                'count': 0,
                'amount': 0
            })
    
    return result

def get_monthly_trend_data(cursor, where_clause, params):
    """Get monthly trend data for all months in current year, including empty ones"""
    # First get all months in the current year
    months_query = """
        WITH months AS (
            SELECT DATE_FORMAT(DATE_ADD(CONCAT(YEAR(CURDATE()), '-01-01'), INTERVAL n MONTH), '%Y-%m') as month
            FROM (
                SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 
                UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 
                UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11
            ) numbers
            WHERE YEAR(DATE_ADD(CONCAT(YEAR(CURDATE()), '-01-01'), INTERVAL n MONTH)) = YEAR(CURDATE())
        )
        SELECT month FROM months ORDER BY month
    """
    cursor.execute(months_query)
    all_months = [row['month'] for row in cursor.fetchall()]
    
    # Get actual data for months that have transactions
    monthly_query = f"""
        SELECT DATE_FORMAT(ft.fees_paid_date, '%Y-%m') as label, 
               SUM(ft.amount_paid) as amount,
               COUNT(ft.fees_trans_id) as count
        FROM student_fee_transactions ft
        WHERE {where_clause} AND ft.payment_status = 'PAID' 
        AND ft.fees_paid_date IS NOT NULL
        AND YEAR(ft.fees_paid_date) = YEAR(CURDATE())
        GROUP BY DATE_FORMAT(ft.fees_paid_date, '%Y-%m')
        ORDER BY label ASC
    """
    cursor.execute(monthly_query, params)
    monthly_data = {row['label']: row for row in cursor.fetchall()}
    
    # Create result with all months, filling zeros for missing months
    result = []
    for month in all_months:
        if month in monthly_data:
            result.append(monthly_data[month])
        else:
            result.append({
                'label': month,
                'amount': 0,
                'count': 0
            })
    
    return result

def get_fees_dashboard_data(filters):
    """Fetches all aggregated data for the fees analytics dashboard."""
    db_conn = None
    cursor = None
    try:
        db_conn = get_db_connection()
        cursor = db_conn.cursor(dictionary=True)
        
        where_clause, params = _build_fees_where_clause(filters)

        # --- KPIs ---
        kpi_query = f"""
            SELECT
                COALESCE(SUM(ft.total_amt), 0) as total_amount,
                COALESCE(SUM(CASE WHEN ft.payment_status IN ('PAID', 'PARTIAL_PAID') THEN ft.amount_paid ELSE 0 END), 0) as total_paid,
                COALESCE(SUM(ft.total_amt - ft.amount_paid), 0) as total_unpaid,
                COUNT(ft.fees_trans_id) as total_transactions,
                COUNT(CASE WHEN ft.payment_status = 'PAID' THEN 1 END) as successful_transactions,
                COUNT(CASE WHEN ft.payment_status IN ('UNPAID', 'PARTIAL_PAID') THEN 1 END) as pending_transactions,
                COUNT(CASE WHEN ft.payment_status = 'REFUNDED' THEN 1 END) as refunded_transactions,
                COALESCE(SUM(ft.refund_amount), 0) as total_refunded
            FROM student_fee_transactions ft
            WHERE {where_clause}
        """
        cursor.execute(kpi_query, params)
        kpis = cursor.fetchone()
        
        def fetch_chart_data(group_by_col, label, count_col='COUNT(*)', sum_col=None, where_extra=""):
            base_query = f"SELECT {group_by_col} as label, {count_col} as count"
            if sum_col:
                base_query += f", COALESCE(SUM({sum_col}), 0) as amount"
            
            query = f"""
                {base_query}
                FROM student_fee_transactions ft
                WHERE {where_clause} AND {group_by_col} IS NOT NULL AND {group_by_col} != '' {where_extra}
                GROUP BY {group_by_col}
                ORDER BY count DESC
                LIMIT 15
            """
            cursor.execute(query, params)
            return cursor.fetchall()

        # --- Payment Status Distribution ---
        payment_status_dist = fetch_chart_data('ft.payment_status', 'Payment Status')
        
        # --- Payment Mode Distribution ---
        payment_mode_dist = fetch_chart_data('ft.payment_mode', 'Payment Mode')
        
        # --- Course-wise Revenue Distribution ---
        course_revenue_dist = fetch_chart_data('ft.course_name', 'Course Revenue', sum_col='ft.amount_paid', where_extra="AND ft.payment_status = 'PAID'")
        
        # --- Installment Distribution ---
        installment_dist = fetch_chart_data('ft.installment_no', 'Installments')
        
        # --- Fee Components Distribution ---
        fee_components = [
            'tuition_fees', 'term_fees', 'library_fees', 'gymkhana_fees', 'other_fees',
            'examination_fees', 'development_fees', 'registration_fees', 'laboratory_fee',
            'pupils_fund', 'activity_fees', 'admission_fees', 'development_fund',
            'refundable_deposit', 'general_deposit', 'enrolment_fee', 'laboratory_deposit',
            'uni_registration_fees', 'student_aid_fees', 'library_deposit',
            'caution_money_deposit', 'lab_fees', 'uni_administration_fees',
            'it_fees', 'pta_fees', 'university_registration_fees', 'laboratory_fees',
            'university_administration_fees', 'library_id_card_etc', 'computer_lab_fees',
            'information_technology_fees', 'iaims_fees_dhe', 'iams_fees',
            'alumni_registration_fees', 'academic_restructuring_and_development_fees',
            'magazine_academic_diary_placement_brochure', 'id_card_fees', 'iaims_fees'
        ]
        
        select_sums = ", ".join([f"COALESCE(SUM({comp}), 0) as {comp}" for comp in fee_components])
        fee_comp_query = f"""
            SELECT {select_sums} 
            FROM student_fee_transactions ft 
            WHERE {where_clause} AND ft.payment_status = 'PAID'
        """
        cursor.execute(fee_comp_query, params)
        fee_comp_data_raw = cursor.fetchone()
        fee_components_dist = []
        if fee_comp_data_raw:
            fee_components_dist = [
                {'label': key.replace('_', ' ').title(), 'amount': value} 
                for key, value in fee_comp_data_raw.items() 
                if value and value > 0
            ]
            # Sort by amount descending
            fee_components_dist.sort(key=lambda x: x['amount'], reverse=True)
        
        
        # --- Daily Transaction Trend (Date Range with All Days) ---
        daily_transaction_trend = get_daily_trend_data(cursor, where_clause, params, filters)
        # --- Institution-wise Revenue Distribution ---
        institution_revenue_dist = fetch_chart_data('ft.institution_code', 'Institution Revenue', sum_col='ft.amount_paid', where_extra="AND ft.payment_status = 'PAID'")
        
        # --- Monthly Revenue Trend (All months in current year) ---
        monthly_revenue_trend = get_monthly_trend_data(cursor, where_clause, params)
        
        # --- Payment Option Distribution ---
        payment_option_dist = fetch_chart_data('ft.payment_option', 'Payment Option')
        
        # --- Due Date Status Distribution (Count Only) ---
        due_date_query = f"""
            SELECT 
                CASE 
                    WHEN ft.due_date IS NULL THEN 'No Due Date'
                    WHEN ft.payment_status = 'PAID' AND ft.fees_paid_date <= ft.due_date THEN 'Paid On Time'
                    WHEN ft.payment_status = 'PAID' AND ft.fees_paid_date > ft.due_date THEN 'Paid Late'
                    WHEN ft.payment_status IN ('UNPAID', 'PARTIAL_PAID') AND ft.due_date < CURDATE() THEN 'Overdue Unpaid'
                    WHEN ft.payment_status IN ('UNPAID', 'PARTIAL_PAID') AND ft.due_date >= CURDATE() THEN 'Pending (Not Due)'
                    ELSE 'Other'
                END as status,
                COUNT(*) as count
            FROM student_fee_transactions ft
            WHERE {where_clause}
            GROUP BY status
        """
        cursor.execute(due_date_query, params)
        due_date_status_dist = cursor.fetchall()

        # Convert all Decimal objects to floats
        result = {
            'kpis': _convert_decimals_to_floats(kpis),
            'paymentStatusDistribution': _convert_decimals_to_floats(payment_status_dist),
            'paymentModeDistribution': _convert_decimals_to_floats(payment_mode_dist),
            'courseRevenueDistribution': _convert_decimals_to_floats(course_revenue_dist),
            'installmentDistribution': _convert_decimals_to_floats(installment_dist),
            'feeComponentsDistribution': _convert_decimals_to_floats(fee_components_dist),
            'dailyTransactionTrend': _convert_decimals_to_floats(daily_transaction_trend),
            'institutionRevenueDistribution': _convert_decimals_to_floats(institution_revenue_dist),
            'monthlyRevenueTrend': _convert_decimals_to_floats(monthly_revenue_trend),
            'paymentOptionDistribution': _convert_decimals_to_floats(payment_option_dist),
            'dueDateStatusDistribution': _convert_decimals_to_floats(due_date_status_dist),
        }

        return result
    finally:
        if cursor: cursor.close()
        if db_conn and db_conn.is_connected(): db_conn.close()

def get_fees_filter_options():
    db_conn = None
    cursor = None
    try:
        db_conn = get_db_connection()
        cursor = db_conn.cursor(dictionary=True)
        
        cursor.execute("SELECT DISTINCT batch_year FROM students_details_master WHERE batch_year IS NOT NULL ORDER BY batch_year DESC")
        batches = [row['batch_year'] for row in cursor.fetchall()]

        cursor.execute("SELECT DISTINCT payment_status FROM student_fee_transactions WHERE payment_status IS NOT NULL AND payment_status != '' ORDER BY payment_status")
        statuses = [row['payment_status'] for row in cursor.fetchall()]

        cursor.execute("SELECT DISTINCT payment_mode FROM student_fee_transactions WHERE payment_mode IS NOT NULL AND payment_mode != '' ORDER BY payment_mode")
        modes = [row['payment_mode'] for row in cursor.fetchall()]

        cursor.execute("SELECT DISTINCT payment_option FROM student_fee_transactions WHERE payment_option IS NOT NULL AND payment_option != '' ORDER BY payment_option")
        options = [row['payment_option'] for row in cursor.fetchall()]

        cursor.execute("SELECT DISTINCT institution_code FROM student_fee_transactions WHERE institution_code IS NOT NULL AND institution_code != '' ORDER BY institution_code")
        institutions = [row['institution_code'] for row in cursor.fetchall()]

        cursor.execute("SELECT DISTINCT course_name FROM student_fee_transactions WHERE course_name IS NOT NULL AND course_name != '' ORDER by course_name")
        courses = [row['course_name'] for row in cursor.fetchall()]

        cursor.execute("SELECT DISTINCT division_name FROM student_fee_transactions WHERE division_name IS NOT NULL AND division_name != '' ORDER by division_name")
        divisions = [row['division_name'] for row in cursor.fetchall()]

        return {
            'batches': batches, 
            'payment_statuses': statuses, 
            'payment_modes': modes,
            'payment_options': options,
            'institutions': institutions,
            'courses': courses,
            'divisions': divisions
        }
    finally:
        if cursor: cursor.close()
        if db_conn and db_conn.is_connected(): db_conn.close()

def get_filtered_transaction_list(filters, is_full_list=False):
    db_conn = None
    cursor = None
    try:
        db_conn = get_db_connection()
        cursor = db_conn.cursor(dictionary=True)

        where_clause, params = _build_fees_where_clause(filters)
        
        # Add drill-down logic
        filter_type = filters.get('filterType')
        filter_value = filters.get('filterValue')
        if filter_type and filter_value:
            # Handle special cases if any, otherwise map directly
            allowed_columns = [
                'payment_status', 'payment_mode', 'course_name', 'installment_no',
                'institution_code', 'payment_option', 'division_name'
            ]
            
            # Handle special filter types
            if filter_type == 'fees_paid_date':
                where_clause += " AND DATE(ft.fees_paid_date) = %s"
                params.append(filter_value)
            elif filter_type == 'month_range':
                # Extract year and month from YYYY-MM format
                year, month = filter_value.split('-')
                where_clause += " AND YEAR(ft.fees_paid_date) = %s AND MONTH(ft.fees_paid_date) = %s"
                params.extend([year, month])
            elif filter_type == 'due_date_status':
                # Special handling for due date status
                if filter_value == 'Overdue Unpaid':
                    where_clause += " AND ft.due_date < CURDATE() AND ft.payment_status IN ('UNPAID', 'PARTIAL_PAID')"
                elif filter_value == 'Paid On Time':
                    where_clause += " AND ft.payment_status = 'PAID' AND ft.fees_paid_date <= ft.due_date"
                elif filter_value == 'Paid Late':
                    where_clause += " AND ft.payment_status = 'PAID' AND ft.fees_paid_date > ft.due_date"
                elif filter_value == 'Pending (Not Due)':
                    where_clause += " AND ft.payment_status IN ('UNPAID', 'PARTIAL_PAID') AND ft.due_date >= CURDATE()"
                elif filter_value == 'No Due Date':
                    where_clause += " AND ft.due_date IS NULL"
            elif filter_type in allowed_columns:
                where_clause += f" AND ft.{filter_type} = %s"
                params.append(filter_value)

        limit_clause = "" if is_full_list else "LIMIT 100"
        
        # List of fee components to include
        fee_components = [
            'tuition_fees', 'term_fees', 'library_fees', 'gymkhana_fees', 'other_fees',
            'examination_fees', 'development_fees', 'registration_fees', 'laboratory_fee',
            'pupils_fund', 'activity_fees', 'admission_fees', 'development_fund',
            'refundable_deposit', 'general_deposit', 'enrolment_fee', 'laboratory_deposit',
            'uni_registration_fees', 'student_aid_fees', 'library_deposit',
            'caution_money_deposit', 'lab_fees', 'uni_administration_fees',
            'it_fees', 'pta_fees', 'university_registration_fees', 'laboratory_fees',
            'university_administration_fees', 'library_id_card_etc', 'computer_lab_fees',
            'information_technology_fees', 'iaims_fees_dhe', 'iams_fees',
            'alumni_registration_fees', 'academic_restructuring_and_development_fees',
            'magazine_academic_diary_placement_brochure', 'id_card_fees', 'iaims_fees'
        ]
        
        # Update the query to include all requested fields
        query = f"""
            SELECT 
                ft.fees_trans_id,
                ft.registration_code,
                ft.student_name,
                ft.fees_paid_date,
                ft.amount_paid,
                ft.total_amt,
                ft.payment_status,
                ft.payment_mode,
                ft.course_name,
                ft.installment_no,
                ft.payment_option,
                ft.institution_code,
                ft.division_name,
                ft.refund_amount,
                ft.due_date,
                ft.qfix_ref_no,
                ft.fees_category,
                ft.payment_details,
                ft.payment_reference_details,
                ft.settlement_date,
                ft.bank_reference_no,
                ft.late_payment_charges,
                {', '.join([f'ft.{comp}' for comp in fee_components])}
            FROM student_fee_transactions ft
            WHERE {where_clause}
            ORDER BY ft.registration_code, ft.fees_paid_date DESC
            {limit_clause}
        """
        cursor.execute(query, params)
        transactions = cursor.fetchall()
        
        # Convert Decimal objects to floats and structure fee components
        processed_transactions = []
        for transaction in transactions:
            # Extract fee components into a separate object
            fee_components_data = {}
            for comp in fee_components:
                if transaction.get(comp) and transaction[comp] > 0:
                    fee_components_data[comp] = float(transaction[comp])
                # Remove the component from the main transaction object
                if comp in transaction:
                    del transaction[comp]
            
            # Add fee components as a nested object
            transaction['fee_components'] = fee_components_data
            processed_transactions.append(transaction)
        
        return _convert_decimals_to_floats(processed_transactions)
    finally:
        if cursor: cursor.close()
        if db_conn and db_conn.is_connected(): db_conn.close()